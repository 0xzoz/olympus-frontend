import { t } from "@lingui/macro";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { ethers } from "ethers";

import { abi as ierc20Abi } from "../abi/IERC20.json";
import { abi as MockSohm } from "../abi/MockSohm.json";
import { abi as OlympusGiving } from "../abi/OlympusGiving.json";
import { abi as OlympusMockGiving } from "../abi/OlympusMockGiving.json";
import { addresses, NetworkId } from "../constants";
import { getGohmBalFromSohm } from "../helpers";
import { trackGAEvent, trackSegmentEvent } from "../helpers/analytics";
import { getGiveProjectName } from "../helpers/GiveProjectNameHelper";
import { fetchAccountSuccess, getBalances, getDonationBalances, getMockDonationBalances } from "./AccountSlice";
import {
  IActionValueRecipientAsyncThunk,
  IBaseAddressAsyncThunk,
  IChangeApprovalAsyncThunk,
  IGiveAsyncThunk,
  IJsonRPCError,
} from "./interfaces";
import { error } from "./MessagesSlice";
import { clearPendingTxn, fetchPendingTxns, getGivingTypeText, IPendingTxn, isPendingTxn } from "./PendingTxnsSlice";

interface IUAData {
  address: string;
  value: string;
  recipient: string;
  approved: boolean;
  txHash: string | null;
  type: string;
}

export const PENDING_TXN_GIVE = "giving";
export const PENDING_TXN_EDIT_GIVE = "editingGive";
export const PENDING_TXN_WITHDRAW = "endingGive";
export const PENDING_TXN_GIVE_APPROVAL = "approve_giving";

export const ACTION_GIVE = "give";
export const ACTION_GIVE_EDIT = "editGive";
export const ACTION_GIVE_WITHDRAW = "endGive";

export const isSupportedChain = (chainID: NetworkId): boolean => {
  // Give is only supported on Ethereum mainnet (1) and rinkeby (4) for the moment.
  if (chainID === NetworkId.MAINNET || chainID === NetworkId.TESTNET_RINKEBY) return true;

  return false;
};

// Checks to confirm if user has any current pending Give transactions (Give, Edit, or Withdraw)
export const hasPendingGiveTxn = (pendingTransactions: IPendingTxn[]): boolean => {
  return (
    isPendingTxn(pendingTransactions, PENDING_TXN_GIVE) ||
    isPendingTxn(pendingTransactions, PENDING_TXN_EDIT_GIVE) ||
    isPendingTxn(pendingTransactions, PENDING_TXN_WITHDRAW)
  );
};

/**
 * Approves Give contract to spend user's sOHM
 * @param provider Ethereum network provider object
 * @param address Current user's Ethereum address
 * @param networkID ID number of the network the user is currently connected to
 */
export const changeApproval = createAsyncThunk(
  "give/changeApproval",
  async ({ provider, address, networkID, token }: IChangeApprovalAsyncThunk, { dispatch }) => {
    if (!provider) {
      dispatch(error(t`Please connect your wallet`));
      return;
    }

    let contractAddress: string;
    let tokenDecimals: number;

    if (token === "sOHM") {
      contractAddress = addresses[networkID].SOHM_V2;
      tokenDecimals = 9;
    } else {
      contractAddress = addresses[networkID].GOHM_ADDRESS;
      tokenDecimals = 18;
    }

    const signer = provider.getSigner();
    const contract = new ethers.Contract(contractAddress, ierc20Abi, signer);

    let approveTx;
    try {
      approveTx = await contract.approve(
        addresses[networkID].GIVING_ADDRESS,
        ethers.utils.parseUnits("10000000000", tokenDecimals).toString(),
      );
      const text = "Approve giving";
      const pendingTxnType = PENDING_TXN_GIVE_APPROVAL;
      dispatch(fetchPendingTxns({ txnHash: approveTx.hash, text, type: pendingTxnType }));
      await approveTx.wait();
    } catch (e: unknown) {
      dispatch(error((e as IJsonRPCError).message));
      return;
    } finally {
      if (approveTx) {
        dispatch(clearPendingTxn(approveTx.hash));
      }
    }

    const giveAllowance = await contract.allowance(address, addresses[networkID].GIVING_ADDRESS);

    if (token === "sOHM") {
      return dispatch(
        fetchAccountSuccess({
          giving: {
            sohmGive: +giveAllowance,
          },
        }),
      );
    } else {
      return dispatch(
        fetchAccountSuccess({
          giving: {
            gohmGive: +giveAllowance,
          },
        }),
      );
    }
  },
);

/**
 * Approves Mock Give contract to spend user's Mock sOHM on Rinkeby
 * @param provider Ethereum network provider object
 * @param address Current user's Ethereum address
 * @param networkID ID number of the network the user is currently connected to
 */
export const changeMockApproval = createAsyncThunk(
  "give/changeMockApproval",
  async ({ provider, address, networkID }: IChangeApprovalAsyncThunk, { dispatch }) => {
    if (!provider) {
      dispatch(error(t`Please connect your wallet`));
      return;
    }

    /*
      On testnet it's been best for testing Give to use a pseudo-sOHM contract
      that gives us more control to rebase manually when needed. However, this 
      makes it not as perfectly translatable to mainnet without changing any parameters
      this is the best way to avoid manually switching out code every deployment
    */
    const signer = provider.getSigner();
    const sohmContract = new ethers.Contract(addresses[networkID].MOCK_SOHM as string, MockSohm, signer);
    let approveTx;
    try {
      approveTx = await sohmContract.approve(
        addresses[networkID].MOCK_GIVING_ADDRESS,
        ethers.utils.parseUnits("1000000000", "gwei").toString(),
      );
      const text = "Approve giving";
      const pendingTxnType = PENDING_TXN_GIVE_APPROVAL;
      dispatch(fetchPendingTxns({ txnHash: approveTx.hash, text, type: pendingTxnType }));
      await approveTx.wait();
    } catch (e: unknown) {
      dispatch(error((e as IJsonRPCError).message));
      return;
    } finally {
      if (approveTx) {
        dispatch(clearPendingTxn(approveTx.hash));
      }
    }

    // The pseudo-sOHM contract used on testnet does not have a functional allowance
    // mapping. Instead approval calls write allowaces to a mapping title _allowedValue
    const giveAllowance = await sohmContract._allowedValue(address, addresses[networkID].MOCK_GIVING_ADDRESS);

    return dispatch(
      fetchAccountSuccess({
        mockGiving: {
          sohmGive: +giveAllowance,
        },
      }),
    );
  },
);

/**
 * Submits transactions to deposit, edit, or withdraw donations to the Give contract
 * @param action The action to take on the contract (New deposit, edit deposit, or withdraw deposit)
 * @param value Amount to either deposit, increase deposit, or reduce deposit
 * @param id The ID number of the deposit to edit or withdraw (pass "-1" in the case of a new deposit)
 * @param provider Ethereum network provider object
 * @param networkID ID number of the network the user is currently connected to
 * @param eventSource Origination point of the call to changeGive
 */
export const changeGive = createAsyncThunk(
  "give/changeGive",
  async (
    { action, value, token, recipient, id, provider, address, networkID, eventSource }: IGiveAsyncThunk,
    { dispatch },
  ) => {
    if (!provider) {
      dispatch(error(t`Please connect your wallet!`));
      return;
    }

    const signer = provider.getSigner();
    const giving = new ethers.Contract(addresses[networkID].GIVING_ADDRESS as string, OlympusGiving, signer);
    let giveTx;

    const uaData: IUAData = {
      address: address,
      value: value,
      recipient: recipient,
      approved: true,
      txHash: null,
      type: "",
    };

    try {
      let pendingTxnType = "";
      if (action === ACTION_GIVE) {
        // If the desired action is a new deposit
        uaData.type = ACTION_GIVE;
        pendingTxnType = PENDING_TXN_GIVE;
        giveTx =
          token === "sOHM"
            ? await giving.depositSohm(ethers.utils.parseUnits(value, "gwei"), recipient)
            : await giving.deposit(ethers.utils.parseEther(value), recipient);
      } else if (action === ACTION_GIVE_EDIT) {
        // If the desired action is adjusting a deposit
        uaData.type = ACTION_GIVE_EDIT;
        pendingTxnType = PENDING_TXN_EDIT_GIVE;
        if (parseFloat(value) > 0) {
          // If the user is increasing the amount of sOHM directing yield to recipient
          giveTx =
            token === "sOHM"
              ? await giving.addToSohmDeposit(id, ethers.utils.parseUnits(value, "gwei"))
              : await giving.addToDeposit(id, ethers.utils.parseEther(value));
        } else if (parseFloat(value) < 0) {
          // If th user is decreasing the amount of sOHM directing yield to recipient
          const reductionAmount = (-1 * parseFloat(value)).toString();
          const gohmAmount = await getGohmBalFromSohm({ provider, networkID: networkID, sOHMbalance: reductionAmount });

          giveTx =
            token === "sOHM"
              ? await giving.withdrawPrincipalAsSohm(id, ethers.utils.parseEther(gohmAmount))
              : await giving.withdrawPrincipal(id, ethers.utils.parseEther(reductionAmount));
        }
      } else if (action === ACTION_GIVE_WITHDRAW) {
        // If the desired action is to remove all sOHM from deposit
        uaData.type = ACTION_GIVE_WITHDRAW;
        pendingTxnType = PENDING_TXN_WITHDRAW;

        const gohmAmount = await getGohmBalFromSohm({ provider, networkID: networkID, sOHMbalance: value });

        giveTx =
          token === "sOHM"
            ? await giving.withdrawPrincipalAsSohm(id, ethers.utils.parseEther(gohmAmount))
            : await giving.withdrawPrincipal(id, ethers.utils.parseEther(value));
      }

      uaData.txHash = giveTx.hash;
      dispatch(fetchPendingTxns({ txnHash: giveTx.hash, text: getGivingTypeText(action), type: pendingTxnType }));

      await giveTx.wait();
    } catch (e: unknown) {
      uaData.approved = false;

      const rpcError = e as IJsonRPCError;
      if (rpcError.code === -32603 && rpcError.message.indexOf("ds-math-sub-underflow") >= 0) {
        dispatch(
          error(t`You may be trying to give more than your balance! Error code: 32603. Message: ds-math-sub-underflow`),
        );
      } else {
        dispatch(error(rpcError.message));
      }
      return;
    } finally {
      if (giveTx) {
        trackSegmentEvent(uaData);
        trackGAEvent({
          category: "Olympus Give",
          action: uaData.type ?? "unknown",
          value: Math.round(parseFloat(uaData.value)),
          label: getGiveProjectName(uaData.recipient) ?? "unknown",
          dimension1: uaData.txHash ?? "unknown",
          dimension2: uaData.address,
        });

        dispatch(clearPendingTxn(giveTx.hash));
      }
    }
    dispatch(getBalances({ address, networkID, provider }));
    dispatch(getDonationBalances({ address, networkID, provider }));
  },
);

/**
 * Submits transactions to deposit, edit, or withdraw donations to the Give contract
 * @param action The action to take on the contract (New deposit, edit deposit, or withdraw deposit)
 * @param value Amount to either deposit, increase deposit, or reduce deposit
 * @param provider Ethereum network provider object
 * @param networkID ID number of the network the user is currently connected to
 * @param eventSource Origination point of the call to changeGive
 */
export const changeMockGive = createAsyncThunk(
  "give/changeMockGive",
  async (
    { action, value, recipient, provider, address, networkID, eventSource }: IActionValueRecipientAsyncThunk,
    { dispatch },
  ) => {
    if (!provider) {
      dispatch(error(t`Please connect your wallet!`));
      return;
    }

    const signer = provider.getSigner();
    const giving = new ethers.Contract(addresses[networkID].MOCK_GIVING_ADDRESS as string, OlympusMockGiving, signer);
    let giveTx;

    const uaData: IUAData = {
      address: address,
      value: value,
      recipient: recipient,
      approved: true,
      txHash: null,
      type: "",
    };

    try {
      let pendingTxnType = "";
      if (action === ACTION_GIVE) {
        // If the desired action is a new deposit
        uaData.type = ACTION_GIVE;
        pendingTxnType = PENDING_TXN_GIVE;
        giveTx = await giving.deposit(ethers.utils.parseUnits(value, "gwei"), recipient);
      } else if (action === ACTION_GIVE_EDIT) {
        // If the desired action is adjusting a deposit
        uaData.type = ACTION_GIVE_EDIT;
        pendingTxnType = PENDING_TXN_EDIT_GIVE;
        if (parseFloat(value) > 0) {
          // If the user is increasing the amount of sOHM directing yield to recipient
          giveTx = await giving.deposit(ethers.utils.parseUnits(value, "gwei"), recipient);
        } else if (parseFloat(value) < 0) {
          // If th user is decreasing the amount of sOHM directing yield to recipient
          const reductionAmount = (-1 * parseFloat(value)).toString();
          giveTx = await giving.withdraw(ethers.utils.parseUnits(reductionAmount, "gwei"), recipient);
        }
      } else if (action === ACTION_GIVE_WITHDRAW) {
        // If the desired action is to remove all sOHM from deposit
        uaData.type = ACTION_GIVE_WITHDRAW;
        pendingTxnType = PENDING_TXN_WITHDRAW;
        giveTx = await giving.withdraw(ethers.utils.parseUnits(value, "gwei"), recipient);
      }
      uaData.txHash = giveTx.hash;
      dispatch(fetchPendingTxns({ txnHash: giveTx.hash, text: getGivingTypeText(action), type: pendingTxnType }));
      await giveTx.wait();
    } catch (e: unknown) {
      uaData.approved = false;
      const rpcError = e as IJsonRPCError;
      if (rpcError.code === -32603 && rpcError.message.indexOf("ds-math-sub-underflow") >= 0) {
        dispatch(
          error(t`You may be trying to give more than your balance! Error code: 32603. Message: ds-math-sub-underflow`),
        );
      } else {
        dispatch(error(rpcError.message));
      }
      return;
    } finally {
      if (giveTx) {
        trackSegmentEvent(uaData);
        trackGAEvent({
          category: "Olympus Give",
          action: uaData.type ?? "unknown",
          label: getGiveProjectName(uaData.recipient) ?? "unknown",
          dimension1: uaData.txHash ?? "unknown",
          dimension2: uaData.address,
          metric1: parseFloat(uaData.value),
          value: Math.round(parseFloat(uaData.value)),
        });
        dispatch(clearPendingTxn(giveTx.hash));
      }
    }
    dispatch(getBalances({ address, networkID, provider }));
    dispatch(getMockDonationBalances({ address, networkID, provider }));
  },
);

/*
  Put in place for anyone testing Give on testnet to easily get our mockSohm tokens
  through a button in the ohmmenu component. Does not appear on mainnet.
*/
export const getTestTokens = createAsyncThunk(
  "give/getTokens",
  async ({ provider, address, networkID }: IBaseAddressAsyncThunk, { dispatch }) => {
    if (!provider) {
      dispatch(error(t`Please connect your wallet!`));
      return;
    }

    const signer = provider.getSigner();
    const mockSohmContract = new ethers.Contract(addresses[networkID].MOCK_SOHM as string, MockSohm, signer);
    const pendingTxnType = "drip";
    let getTx;
    try {
      getTx = await mockSohmContract.drip();
      dispatch(fetchPendingTxns({ txnHash: getTx.hash, text: "Drip", type: pendingTxnType }));
      await getTx.wait();
    } catch (e: unknown) {
      const rpcError = e as IJsonRPCError;
      dispatch(error(rpcError.message));
      return;
    } finally {
      if (getTx) {
        dispatch(clearPendingTxn(getTx.hash));
      }
    }
    dispatch(getBalances({ address, networkID, provider }));
  },
);
