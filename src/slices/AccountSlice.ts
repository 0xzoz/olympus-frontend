import { OHMTokenStackProps } from "@olympusdao/component-library";
import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import { BigNumber, BigNumberish, ethers } from "ethers";
import {
  GOHM_ADDRESSES,
  MIGRATOR_ADDRESSES,
  OHM_ADDRESSES,
  SOHM_ADDRESSES,
  STAKING_ADDRESSES,
} from "src/constants/addresses";
import { Environment } from "src/helpers/environment/Environment/Environment";
import { Providers } from "src/helpers/providers/Providers/Providers";
import { RootState } from "src/store";
import { FiatDAOContract, FuseProxy, IERC20, IERC20__factory, WsOHM } from "src/typechain";
import { GOHM__factory } from "src/typechain/factories/GOHM__factory";

import { abi as fiatDAO } from "../abi/FiatDAOContract.json";
import { abi as fuseProxy } from "../abi/FuseProxy.json";
import { abi as ierc20Abi } from "../abi/IERC20.json";
import { abi as MockSohm } from "../abi/MockSohm.json";
import { abi as wsOHM } from "../abi/wsOHM.json";
import { addresses, NetworkId } from "../constants";
import { handleContractError, setAll } from "../helpers";
import { IBaseAddressAsyncThunk, ICalcUserBondDetailsAsyncThunk } from "./interfaces";

interface IUserBalances {
  balances: {
    gohm: string;
    gOhmAsSohmBal: string;
    gOhmOnArbitrum: string;
    gOhmOnArbAsSohm: string;
    gOhmOnAvax: string;
    gOhmOnAvaxAsSohm: string;
    gOhmOnPolygon: string;
    gOhmOnPolygonAsSohm: string;
    gOhmOnFantom: string;
    gOhmOnFantomAsSohm: string;
    gOhmOnTokemak: string;
    gOhmOnTokemakAsSohm: string;
    ohm: string;
    ohmV1: string;
    sohm: string;
    sohmV1: string;
    fsohm: string;
    fgohm: string;
    fgOHMAsfsOHM: string;
    wsohm: string;
    fiatDaowsohm: string;
    mockSohm: string;
  };
}

export const getBalances = createAsyncThunk(
  "account/getBalances",
  async ({ address, networkID, provider }: IBaseAddressAsyncThunk): Promise<IUserBalances> => {
    let gOhmBalance = BigNumber.from("0");
    let gOhmBalAsSohmBal = BigNumber.from("0");
    let gOhmOnArbitrum = BigNumber.from("0");
    let gOhmOnArbAsSohm = BigNumber.from("0");
    let gOhmOnAvax = BigNumber.from("0");
    let gOhmOnAvaxAsSohm = BigNumber.from("0");
    let gOhmOnPolygon = BigNumber.from("0");
    let gOhmOnPolygonAsSohm = BigNumber.from("0");
    let gOhmOnFantom = BigNumber.from("0");
    let gOhmOnFantomAsSohm = BigNumber.from("0");
    let gOhmOnTokemak = BigNumber.from("0");
    let gOhmOnTokemakAsSohm = BigNumber.from("0");
    let ohmBalance = BigNumber.from("0");
    let sohmBalance = BigNumber.from("0");
    let mockSohmBalance = BigNumber.from("0");
    let ohmV2Balance = BigNumber.from("0");
    let sohmV2Balance = BigNumber.from("0");
    let wsohmBalance = BigNumber.from("0");
    let fsohmBalance = BigNumber.from(0);
    let fgohmBalance = BigNumber.from(0);
    let fgOHMAsfsOHMBalance = BigNumber.from(0);
    let fiatDaowsohmBalance = BigNumber.from("0");

    const gOhmContract = GOHM__factory.connect(GOHM_ADDRESSES[networkID as keyof typeof GOHM_ADDRESSES], provider);
    try {
      gOhmBalance = await gOhmContract.balanceOf(address);
      gOhmBalAsSohmBal = await gOhmContract.balanceFrom(gOhmBalance.toString());
    } catch (e) {
      handleContractError(e);
    }
    try {
      const arbProvider = Providers.getStaticProvider(NetworkId.ARBITRUM);
      const gOhmArbContract = GOHM__factory.connect(GOHM_ADDRESSES[NetworkId.ARBITRUM], arbProvider);
      gOhmOnArbitrum = await gOhmArbContract.balanceOf(address);
      gOhmOnArbAsSohm = await gOhmContract.balanceFrom(gOhmOnArbitrum.toString());
    } catch (e) {
      handleContractError(e);
    }
    try {
      const avaxProvider = Providers.getStaticProvider(NetworkId.AVALANCHE);
      const gOhmAvaxContract = GOHM__factory.connect(GOHM_ADDRESSES[NetworkId.AVALANCHE], avaxProvider);
      gOhmOnAvax = await gOhmAvaxContract.balanceOf(address);
      gOhmOnAvaxAsSohm = await gOhmContract.balanceFrom(gOhmOnAvax.toString());
    } catch (e) {
      handleContractError(e);
    }
    try {
      const polygonProvider = Providers.getStaticProvider(NetworkId.POLYGON);
      const gOhmPolygonContract = GOHM__factory.connect(GOHM_ADDRESSES[NetworkId.POLYGON], polygonProvider);
      gOhmOnPolygon = await gOhmPolygonContract.balanceOf(address);
      gOhmOnPolygonAsSohm = await gOhmContract.balanceFrom(gOhmOnPolygon.toString());
    } catch (e) {
      handleContractError(e);
    }
    try {
      const fantomProvider = Providers.getStaticProvider(NetworkId.FANTOM);
      const gOhmFantomContract = GOHM__factory.connect(GOHM_ADDRESSES[NetworkId.FANTOM], fantomProvider);
      gOhmOnFantom = await gOhmFantomContract.balanceOf(address);
      gOhmOnFantomAsSohm = await gOhmContract.balanceFrom(gOhmOnFantom.toString());
    } catch (e) {
      handleContractError(e);
    }
    try {
      const tokemakProvider = Providers.getStaticProvider(NetworkId.MAINNET);
      const gOhmTokemakContract = GOHM__factory.connect(addresses[NetworkId.MAINNET].TOKEMAK_GOHM, tokemakProvider);
      gOhmOnTokemak = await gOhmTokemakContract.balanceOf(address);
      gOhmOnTokemakAsSohm = await gOhmContract.balanceFrom(gOhmOnTokemak.toString());
    } catch (e) {
      handleContractError(e);
    }
    try {
      const wsohmContract = new ethers.Contract(addresses[networkID].WSOHM_ADDRESS as string, wsOHM, provider) as WsOHM;
      wsohmBalance = await wsohmContract.balanceOf(address);
    } catch (e) {
      handleContractError(e);
    }
    try {
      const ohmContract = new ethers.Contract(
        addresses[networkID].OHM_ADDRESS as string,
        ierc20Abi,
        provider,
      ) as IERC20;
      ohmBalance = await ohmContract.balanceOf(address);
    } catch (e) {
      handleContractError(e);
    }
    try {
      const sohmContract = new ethers.Contract(
        addresses[networkID].SOHM_ADDRESS as string,
        ierc20Abi,
        provider,
      ) as IERC20;
      sohmBalance = await sohmContract.balanceOf(address);
    } catch (e) {
      handleContractError(e);
    }
    try {
      const ohmV2Contract = new ethers.Contract(
        OHM_ADDRESSES[networkID as keyof typeof OHM_ADDRESSES] as string,
        ierc20Abi,
        provider,
      ) as IERC20;
      ohmV2Balance = await ohmV2Contract.balanceOf(address);
    } catch (e) {
      handleContractError(e);
    }
    try {
      const sohmV2Contract = new ethers.Contract(
        SOHM_ADDRESSES[networkID as keyof typeof SOHM_ADDRESSES] as string,
        ierc20Abi,
        provider,
      ) as IERC20;
      sohmV2Balance = await sohmV2Contract.balanceOf(address);
    } catch (e) {
      handleContractError(e);
    }
    try {
      for (const fuseAddressKey of ["FUSE_6_SOHM", "FUSE_18_SOHM", "FUSE_36_SOHM"]) {
        if (addresses[networkID][fuseAddressKey]) {
          const fsohmContract = new ethers.Contract(
            addresses[networkID][fuseAddressKey] as string,
            fuseProxy,
            provider.getSigner(),
          ) as FuseProxy;
          const balanceOfUnderlying = await fsohmContract.callStatic.balanceOfUnderlying(address);
          const underlying = await fsohmContract.callStatic.underlying();
          if (underlying == GOHM_ADDRESSES[networkID as keyof typeof GOHM_ADDRESSES]) {
            fgohmBalance = balanceOfUnderlying.add(fgohmBalance);
          } else fsohmBalance = balanceOfUnderlying.add(fsohmBalance);
        }
      }
      const gOhmContract = GOHM__factory.connect(GOHM_ADDRESSES[networkID as keyof typeof GOHM_ADDRESSES], provider);
      if (fgohmBalance.gt(0)) {
        fgOHMAsfsOHMBalance = await gOhmContract.balanceFrom(fgohmBalance.toString());
      }
    } catch (e) {
      handleContractError(e);
    }
    try {
      if (addresses[networkID].FIATDAO_WSOHM_ADDRESS) {
        const fiatDaoContract = new ethers.Contract(
          addresses[networkID].FIATDAO_WSOHM_ADDRESS as string,
          fiatDAO,
          provider,
        ) as FiatDAOContract;
        fiatDaowsohmBalance = await fiatDaoContract.balanceOf(address, addresses[networkID].WSOHM_ADDRESS as string);
      }
    } catch (e) {
      handleContractError(e);
    }
    /*
      Needed a sOHM contract on testnet that could easily
      be manually rebased to test redeem features
    */
    try {
      if (Environment.isGiveEnabled() && addresses[networkID] && addresses[networkID].MOCK_SOHM) {
        const mockSohmContract = new ethers.Contract(
          addresses[networkID].MOCK_SOHM as string,
          MockSohm,
          provider,
        ) as IERC20;
        mockSohmBalance = await mockSohmContract.balanceOf(address);
      } else {
        console.debug("Unable to find MOCK_SOHM contract on chain ID " + networkID);
      }
    } catch (e) {
      handleContractError(e);
    }

    return {
      balances: {
        gohm: ethers.utils.formatEther(gOhmBalance),
        gOhmAsSohmBal: ethers.utils.formatUnits(gOhmBalAsSohmBal, "gwei"),
        gOhmOnArbitrum: ethers.utils.formatEther(gOhmOnArbitrum),
        gOhmOnArbAsSohm: ethers.utils.formatUnits(gOhmOnArbAsSohm, "gwei"),
        gOhmOnAvax: ethers.utils.formatEther(gOhmOnAvax),
        gOhmOnAvaxAsSohm: ethers.utils.formatUnits(gOhmOnAvaxAsSohm, "gwei"),
        gOhmOnPolygon: ethers.utils.formatEther(gOhmOnPolygon),
        gOhmOnPolygonAsSohm: ethers.utils.formatUnits(gOhmOnPolygonAsSohm, "gwei"),
        gOhmOnFantom: ethers.utils.formatEther(gOhmOnFantom),
        gOhmOnFantomAsSohm: ethers.utils.formatUnits(gOhmOnFantomAsSohm, "gwei"),
        gOhmOnTokemak: ethers.utils.formatEther(gOhmOnTokemak),
        gOhmOnTokemakAsSohm: ethers.utils.formatUnits(gOhmOnTokemakAsSohm, "gwei"),
        ohmV1: ethers.utils.formatUnits(ohmBalance, "gwei"),
        sohmV1: ethers.utils.formatUnits(sohmBalance, "gwei"),
        fsohm: ethers.utils.formatUnits(fsohmBalance, "gwei"),
        fgohm: ethers.utils.formatEther(fgohmBalance),
        fgOHMAsfsOHM: ethers.utils.formatUnits(fgOHMAsfsOHMBalance, "gwei"),
        wsohm: ethers.utils.formatEther(wsohmBalance),
        fiatDaowsohm: ethers.utils.formatEther(fiatDaowsohmBalance),
        ohm: ethers.utils.formatUnits(ohmV2Balance, "gwei"),
        sohm: ethers.utils.formatUnits(sohmV2Balance, "gwei"),
        mockSohm: ethers.utils.formatUnits(mockSohmBalance, "gwei"),
      },
    };
  },
);

interface IUserAccountDetails {
  staking: {
    ohmStake: number;
    ohmUnstake: number;
  };
  wrapping: {
    sohmWrap: number;
    wsohmUnwrap: number;
    gOhmUnwrap: number;
    wsOhmMigrate: number;
  };
}

export const getMigrationAllowances = createAsyncThunk(
  "account/getMigrationAllowances",
  async ({ networkID, provider, address }: IBaseAddressAsyncThunk) => {
    let ohmAllowance = BigNumber.from(0);
    let sOhmAllowance = BigNumber.from(0);
    let wsOhmAllowance = BigNumber.from(0);
    let gOhmAllowance = BigNumber.from(0);

    if (addresses[networkID].OHM_ADDRESS) {
      try {
        const ohmContract = IERC20__factory.connect(addresses[networkID].OHM_ADDRESS, provider);
        ohmAllowance = await ohmContract.allowance(
          address,
          MIGRATOR_ADDRESSES[networkID as keyof typeof MIGRATOR_ADDRESSES],
        );
      } catch (e) {
        handleContractError(e);
      }
    }

    if (addresses[networkID].SOHM_ADDRESS) {
      try {
        const sOhmContract = IERC20__factory.connect(addresses[networkID].SOHM_ADDRESS, provider);
        sOhmAllowance = await sOhmContract.allowance(
          address,
          MIGRATOR_ADDRESSES[networkID as keyof typeof MIGRATOR_ADDRESSES],
        );
      } catch (e) {
        handleContractError(e);
      }
    }

    if (addresses[networkID].WSOHM_ADDRESS) {
      try {
        const wsOhmContract = IERC20__factory.connect(addresses[networkID].WSOHM_ADDRESS, provider);
        wsOhmAllowance = await wsOhmContract.allowance(
          address,
          MIGRATOR_ADDRESSES[networkID as keyof typeof MIGRATOR_ADDRESSES],
        );
      } catch (e) {
        handleContractError(e);
      }
    }

    if (GOHM_ADDRESSES[networkID as keyof typeof GOHM_ADDRESSES]) {
      try {
        const gOhmContract = IERC20__factory.connect(
          GOHM_ADDRESSES[networkID as keyof typeof GOHM_ADDRESSES],
          provider,
        );
        gOhmAllowance = await gOhmContract.allowance(
          address,
          MIGRATOR_ADDRESSES[networkID as keyof typeof MIGRATOR_ADDRESSES],
        );
      } catch (e) {
        handleContractError(e);
      }
    }

    return {
      migration: {
        ohm: +ohmAllowance,
        sohm: +sOhmAllowance,
        wsohm: +wsOhmAllowance,
        gohm: +gOhmAllowance,
      },
      isMigrationComplete: false,
    };
  },
);

export const loadAccountDetails = createAsyncThunk(
  "account/loadAccountDetails",
  async ({ networkID, provider, address }: IBaseAddressAsyncThunk, { dispatch }) => {
    let stakeAllowance = BigNumber.from("0");
    let stakeAllowanceV2 = BigNumber.from("0");
    let unstakeAllowanceV2 = BigNumber.from("0");
    let unstakeAllowance = BigNumber.from("0");
    let wrapAllowance = BigNumber.from("0");
    let gOhmUnwrapAllowance = BigNumber.from("0");
    const ohmToGohmAllowance = BigNumber.from("0");
    let wsOhmMigrateAllowance = BigNumber.from("0");

    try {
      const gOhmContract = GOHM__factory.connect(GOHM_ADDRESSES[networkID as keyof typeof GOHM_ADDRESSES], provider);
      gOhmUnwrapAllowance = await gOhmContract.allowance(
        address,
        STAKING_ADDRESSES[networkID as keyof typeof STAKING_ADDRESSES],
      );

      const wsOhmContract = IERC20__factory.connect(addresses[networkID].WSOHM_ADDRESS, provider);
      wsOhmMigrateAllowance = await wsOhmContract.balanceOf(address);

      const ohmContract = new ethers.Contract(
        addresses[networkID].OHM_ADDRESS as string,
        ierc20Abi,
        provider,
      ) as IERC20;
      stakeAllowance = await ohmContract.allowance(address, addresses[networkID].STAKING_HELPER_ADDRESS);

      const sohmContract = new ethers.Contract(
        addresses[networkID].SOHM_ADDRESS as string,
        ierc20Abi,
        provider,
      ) as IERC20;
      unstakeAllowance = await sohmContract.allowance(address, addresses[networkID].STAKING_ADDRESS);
      wrapAllowance = await sohmContract.allowance(
        address,
        STAKING_ADDRESSES[networkID as keyof typeof STAKING_ADDRESSES],
      );

      const sohmV2Contract = IERC20__factory.connect(
        SOHM_ADDRESSES[networkID as keyof typeof SOHM_ADDRESSES],
        provider,
      );
      unstakeAllowanceV2 = await sohmV2Contract.allowance(
        address,
        STAKING_ADDRESSES[networkID as keyof typeof STAKING_ADDRESSES],
      );

      const ohmV2Contract = IERC20__factory.connect(OHM_ADDRESSES[networkID as keyof typeof OHM_ADDRESSES], provider);
      stakeAllowanceV2 = await ohmV2Contract.allowance(
        address,
        STAKING_ADDRESSES[networkID as keyof typeof STAKING_ADDRESSES],
      );
    } catch (e) {
      handleContractError(e);
    }
    await dispatch(getBalances({ address, networkID, provider }));

    return {
      staking: {
        ohmStakeV1: +stakeAllowance,
        ohmUnstakeV1: +unstakeAllowance,
        ohmStake: +stakeAllowanceV2,
        ohmUnstake: +unstakeAllowanceV2,
        ohmtoGohm: +ohmToGohmAllowance,
      },
      wrapping: {
        sohmWrap: Number(ethers.utils.formatUnits(wrapAllowance, "gwei")),
        gOhmUnwrap: Number(ethers.utils.formatUnits(gOhmUnwrapAllowance, "ether")),
        wsOhmMigrate: Number(ethers.utils.formatUnits(wsOhmMigrateAllowance, "ether")),
      },
    };
  },
);

export interface IUserBondDetails {
  // bond: string;
  readonly bond: string;
  readonly balance: string;
  readonly displayName: string;
  readonly allowance: number;
  readonly interestDue: number;
  readonly bondMaturationBlock: number;
  readonly pendingPayout: string; //Payout formatted in gwei.
  readonly bondIconSvg: OHMTokenStackProps["tokens"]; //Payout formatted in gwei.
}
export const calculateUserBondDetails = createAsyncThunk(
  "account/calculateUserBondDetails",
  async ({ address, bond, networkID, provider }: ICalcUserBondDetailsAsyncThunk) => {
    if (!address) {
      return {
        bond: "",
        displayName: "",
        bondIconSvg: [],
        isLP: false,
        allowance: 0,
        balance: "0",
        interestDue: 0,
        bondMaturationBlock: 0,
        pendingPayout: "",
      };
    }
    // dispatch(fetchBondInProgress());

    // Calculate bond details.
    const bondContract = bond.getContractForBond(networkID, provider);
    const reserveContract = bond.getContractForReserve(networkID, provider);
    const bondDetails = await bondContract.bondInfo(address);
    const interestDue: BigNumberish = Number(bondDetails.payout.toString()) / Math.pow(10, 9);
    const bondMaturationBlock = +bondDetails.vesting + +bondDetails.lastBlock;
    const pendingPayout = await bondContract.pendingPayoutFor(address);

    let balance = BigNumber.from(0);
    const allowance = await reserveContract.allowance(address, bond.getAddressForBond(networkID) || "");
    balance = await reserveContract.balanceOf(address);
    // formatEthers takes BigNumber => String
    const balanceVal = ethers.utils.formatEther(balance);
    // balanceVal should NOT be converted to a number. it loses decimal precision
    return {
      bond: bond.name,
      displayName: bond.displayName,
      bondIconSvg: bond.bondIconSvg,
      isLP: bond.isLP,
      allowance: Number(allowance.toString()),
      balance: balanceVal,
      interestDue,
      bondMaturationBlock,
      pendingPayout: ethers.utils.formatUnits(pendingPayout, "gwei"),
    };
  },
);

export interface IAccountSlice extends IUserAccountDetails, IUserBalances {
  bonds: { [key: string]: IUserBondDetails };
  balances: {
    gohm: string;
    gOhmAsSohmBal: string;
    gOhmOnArbitrum: string;
    gOhmOnArbAsSohm: string;
    gOhmOnAvax: string;
    gOhmOnAvaxAsSohm: string;
    gOhmOnPolygon: string;
    gOhmOnPolygonAsSohm: string;
    gOhmOnFantom: string;
    gOhmOnFantomAsSohm: string;
    gOhmOnTokemak: string;
    gOhmOnTokemakAsSohm: string;
    ohmV1: string;
    ohm: string;
    sohm: string;
    sohmV1: string;
    dai: string;
    oldsohm: string;
    fsohm: string;
    fgohm: string;
    fgOHMAsfsOHM: string;
    wsohm: string;
    fiatDaowsohm: string;
    pool: string;
    mockSohm: string;
  };
  loading: boolean;
  staking: {
    ohmStakeV1: number;
    ohmUnstakeV1: number;
    ohmStake: number;
    ohmUnstake: number;
  };
  migration: {
    ohm: number;
    sohm: number;
    wsohm: number;
    gohm: number;
  };
  pooling: {
    sohmPool: number;
  };
  isMigrationComplete: boolean;
}

const initialState: IAccountSlice = {
  loading: false,
  bonds: {},
  balances: {
    gohm: "",
    gOhmAsSohmBal: "",
    gOhmOnArbitrum: "",
    gOhmOnArbAsSohm: "",
    gOhmOnAvax: "",
    gOhmOnAvaxAsSohm: "",
    gOhmOnPolygon: "",
    gOhmOnPolygonAsSohm: "",
    gOhmOnFantom: "",
    gOhmOnFantomAsSohm: "",
    gOhmOnTokemak: "",
    gOhmOnTokemakAsSohm: "",
    ohmV1: "",
    ohm: "",
    sohm: "",
    sohmV1: "",
    dai: "",
    oldsohm: "",
    fsohm: "",
    fgohm: "",
    fgOHMAsfsOHM: "",
    wsohm: "",
    fiatDaowsohm: "",
    pool: "",
    mockSohm: "",
  },
  staking: { ohmStakeV1: 0, ohmUnstakeV1: 0, ohmStake: 0, ohmUnstake: 0 },
  wrapping: { sohmWrap: 0, wsohmUnwrap: 0, gOhmUnwrap: 0, wsOhmMigrate: 0 },
  pooling: { sohmPool: 0 },
  migration: { ohm: 0, sohm: 0, wsohm: 0, gohm: 0 },
  isMigrationComplete: false,
};

const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    fetchAccountSuccess(state, action) {
      setAll(state, action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadAccountDetails.pending, state => {
        state.loading = true;
      })
      .addCase(loadAccountDetails.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(loadAccountDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(getBalances.pending, state => {
        state.loading = true;
      })
      .addCase(getBalances.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(getBalances.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(calculateUserBondDetails.pending, state => {
        state.loading = true;
      })
      .addCase(calculateUserBondDetails.fulfilled, (state, action) => {
        if (!action.payload) return;
        const bond = action.payload.bond;
        state.bonds[bond] = action.payload;
        state.loading = false;
      })
      .addCase(calculateUserBondDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(getMigrationAllowances.fulfilled, (state, action) => {
        setAll(state, action.payload);
      })
      .addCase(getMigrationAllowances.rejected, (state, { error }) => {
        console.log(error);
      });
  },
});

export default accountSlice.reducer;

export const { fetchAccountSuccess } = accountSlice.actions;

const baseInfo = (state: RootState) => state.account;

export const getAccountState = createSelector(baseInfo, account => account);
