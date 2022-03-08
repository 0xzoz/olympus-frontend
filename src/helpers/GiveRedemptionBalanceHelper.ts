import { BigNumber, ethers } from "ethers";

import { abi as gOHM } from "../abi/gOHM.json";
import { abi as OlympusGiving } from "../abi/OlympusGiving.json";
import { addresses } from "../constants";
import { IBaseAddressAsyncThunk } from "../slices/interfaces";

interface IUserRecipientInfo {
  totalDebt: string;
  agnosticDebt: string;
}

interface IDonorAddresses {
  [key: string]: boolean;
}

// Gets a recipient's info. Separating it out into a helper allows us to call it on addresses
// other than the current user's without overwriting the data in Redux store. This is needed
// to pull data on our partner projects
export const getRedemptionBalancesAsync = async ({ address, networkID, provider }: IBaseAddressAsyncThunk) => {
  let redeemableBalance = 0;
  const recipientInfo: IUserRecipientInfo = {
    totalDebt: "0",
    agnosticDebt: "0",
  };

  if (!(addresses[networkID] && addresses[networkID].GIVING_ADDRESS)) {
    console.log("Unable to find MOCK_SOHM contract on chain ID " + networkID);
  } else {
    const gohmContract = new ethers.Contract(addresses[networkID].GOHM_ADDRESS as string, gOHM, provider);
    const givingContract = new ethers.Contract(addresses[networkID].GIVING_ADDRESS as string, OlympusGiving, provider);

    // Get current redeemable balance across all deposits to the user. This is
    // returned in gOHM, so it has to be converted from gOHM to sOHM to be
    // represented in the frontend
    const gohmRedeemable = await givingContract.totalRedeemableBalance(address);
    redeemableBalance = await gohmContract.balanceFrom(gohmRedeemable);

    try {
      const recipientIds = await givingContract.getRecipientIds(address);

      // Variable to represent the total amount of sOHM debt directed to the user
      let sumDebt = BigNumber.from("0");

      // Variable to represent the total amount of gOHM debt directed to the user
      let sumAgnosticDebt = BigNumber.from("0");

      for (let i = 0; i < recipientIds.length; i++) {
        const currDeposit = await givingContract.depositInfo(recipientIds[i]);

        // Adds sOHM principal debt
        sumDebt = sumDebt.add(currDeposit.principalAmount);
      }

      // Converts sOHM principal debt to gOHM equivalent
      sumAgnosticDebt = await gohmContract.balanceTo(sumDebt);

      recipientInfo.totalDebt = ethers.utils.formatUnits(sumDebt.toNumber(), "gwei");
      recipientInfo.agnosticDebt = ethers.utils.formatEther(sumAgnosticDebt);
    } catch (e: unknown) {
      console.log(e);
    }
  }

  return {
    redeeming: {
      sohmRedeemable: ethers.utils.formatUnits(redeemableBalance, "gwei"),
      recipientInfo: recipientInfo,
    },
  };
};

// Gets a recipient's info but from the MockGive contract on Rinkeby
export const getMockRedemptionBalancesAsync = async ({ address, networkID, provider }: IBaseAddressAsyncThunk) => {
  let redeemableBalance = 0;
  const recipientInfo: IUserRecipientInfo = {
    totalDebt: "",
    agnosticDebt: "",
  };

  if (addresses[networkID] && addresses[networkID].MOCK_GIVING_ADDRESS) {
    const givingContract = new ethers.Contract(
      addresses[networkID].MOCK_GIVING_ADDRESS as string,
      OlympusGiving,
      provider,
    );
    redeemableBalance = await givingContract.redeemableBalance(address);

    try {
      const recipientInfoData = await givingContract.recipientInfo(address);
      recipientInfo.totalDebt = ethers.utils.formatUnits(recipientInfoData.totalDebt.toNumber(), "gwei");
      recipientInfo.agnosticDebt = ethers.utils.formatUnits(recipientInfoData.agnosticDebt.toNumber(), "gwei");
    } catch (e: unknown) {
      console.log(e);
    }
  } else {
    console.log("Unable to find MOCK_GIVING_ADDRESS contract on chain ID " + networkID);
  }

  return {
    mockRedeeming: {
      sohmRedeemable: ethers.utils.formatUnits(redeemableBalance, "gwei"),
      recipientInfo: recipientInfo,
    },
  };
};

/*
  With the old YieldDirector contract hooked to MockSohm this will no longer work
  but it will work with the new YieldDirector version that indexes event topics
*/
export const getDonorNumbers = async ({ address, networkID, provider }: IBaseAddressAsyncThunk) => {
  const donationsToAddress = [];

  if (!(addresses[networkID] && addresses[networkID].GIVING_ADDRESS)) {
    console.log("Unable to find MOCK_SOHM contract on chain ID " + networkID);
    return;
  } else {
    // Addresses in EVM events are zero padded out to 32 characters and are lower case
    // This matches our inputs with the data we expect to receive from Ethereum
    const zeroPadAddress = ethers.utils.hexZeroPad(address, 32);

    const givingContract = new ethers.Contract(addresses[networkID].GIVING_ADDRESS as string, OlympusGiving, provider);

    // creates a filter looking at all Deposited events on the YieldDirector contract
    const filter = {
      address: addresses[networkID].GIVING_ADDRESS,
      fromBlock: 1,
      toBlock: "latest",
      topics: [ethers.utils.id("Deposited(address,address,uint256)"), null, zeroPadAddress], // hash identifying Deposited event
    };

    // using the filter, get all events
    const events = await provider.getLogs(filter);

    const donorAddresses: IDonorAddresses = {};
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      if (event.topics[2] === zeroPadAddress.toLowerCase()) {
        const donorActiveDonations: [string[], BigNumber[]] = await givingContract.getAllDeposits(
          ethers.utils.hexDataSlice(event.topics[1], 12),
        );
        // make sure the deposit was an active donation and has not been withdrawn
        for (let j = 0; j < donorActiveDonations[0].length; j++) {
          // Makes sure that the recipient matches the one we are looking for,
          // that the deposit amount is not 0, and that the user is not already
          // counted for donating in a previous Deposited event
          if (
            donorActiveDonations[0][j].toLowerCase() == address.toLowerCase() &&
            donorActiveDonations[1][j] > BigNumber.from(0) &&
            !donorAddresses[event.topics[1]]
          ) {
            donationsToAddress.push(event);
            // keep track of active donors so multiple deposits are not counted as multiple donors
            donorAddresses[event.topics[1]] = true;
          }
        }
      }
    }
  }

  return donationsToAddress;
};
