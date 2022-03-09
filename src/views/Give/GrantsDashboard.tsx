import "./Give.scss";

import { t, Trans } from "@lingui/macro";
import { Box, Typography, Zoom } from "@material-ui/core";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { BigNumber } from "bignumber.js";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUIDSeed } from "react-uid";
import GrantCard, { GrantDetailsMode } from "src/components/GiveProject/GrantCard";
import { Grant } from "src/components/GiveProject/project.type";
import { NetworkId } from "src/constants";
import { EnvHelper } from "src/helpers/Environment";
import { useAppDispatch } from "src/hooks";
import { useWeb3Context } from "src/hooks/web3Context";
import { ACTION_GIVE, changeGive, changeMockGive, isSupportedChain } from "src/slices/GiveThunk";
import { CancelCallback, SubmitCallback } from "src/views/Give/Interfaces";
import { RecipientModal } from "src/views/Give/RecipientModal";

import { error } from "../../slices/MessagesSlice";
import data from "./grants.json";

export default function GrantsDashboard() {
  const location = useLocation();
  const { provider, address, networkId } = useWeb3Context();
  const [isCustomGiveModalOpen, setIsCustomGiveModalOpen] = useState(false);
  const isSmallScreen = useMediaQuery("(max-width: 600px)");
  const isMediumScreen = useMediaQuery("(max-width: 980px)") && !isSmallScreen;
  const grants: Grant[] = data.grants;

  // We use useAppDispatch here so the result of the AsyncThunkAction is typed correctly
  // See: https://stackoverflow.com/a/66753532
  const dispatch = useAppDispatch();
  const seed = useUIDSeed();

  const renderGrants = useMemo(() => {
    let activeGrants = 0;

    const grantElements: JSX.Element[] = grants.map(grant => {
      if (grant.disabled) return <></>;

      activeGrants++;
      return <GrantCard key={seed(grant.title)} grant={grant} mode={GrantDetailsMode.Card} />;
    });

    if (activeGrants > 0) return grantElements;

    return (
      <Typography variant="body2">
        <Trans>We don't have any grants open right now, but check back soon!</Trans>
      </Typography>
    );
  }, [grants]);

  const handleCustomGiveModalSubmit: SubmitCallback = async (
    walletAddress: string,
    eventSource: string,
    depositAmount: BigNumber,
  ) => {
    if (depositAmount.isEqualTo(new BigNumber(0))) {
      return dispatch(error(t`Please enter a value!`));
    }

    // If on Rinkeby and using Mock Sohm, use the changeMockGive async thunk
    // Else use standard call
    if (networkId === NetworkId.TESTNET_RINKEBY && EnvHelper.isMockSohmEnabled(location.search)) {
      await dispatch(
        changeMockGive({
          action: ACTION_GIVE,
          value: depositAmount.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
          eventSource: eventSource,
        }),
      );
    } else {
      await dispatch(
        changeGive({
          action: ACTION_GIVE,
          value: depositAmount.toFixed(),
          recipient: walletAddress,
          id: "-1",
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
          eventSource: eventSource,
        }),
      );
    }

    setIsCustomGiveModalOpen(false);
  };

  const handleCustomGiveModalCancel: CancelCallback = () => {
    setIsCustomGiveModalOpen(false);
  };

  return (
    <div
      id="give-view"
      className={`${isMediumScreen ? "medium" : ""}
      ${isSmallScreen ? "smaller" : ""}}`}
    >
      <Zoom in={true}>
        <Box className={`ohm-card secondary causes-container`}>
          {!isSupportedChain(networkId) ? (
            <Typography variant="h6">
              <Trans>
                Note: You are currently using an unsupported network. Please switch to Ethereum to experience the full
                functionality.
              </Trans>
            </Typography>
          ) : (
            <></>
          )}
          <div className="causes-body">
            <Typography variant="body1" className="grants-header">
              <Trans>
                Upon receiving an Olympus Grant, you gain exposure to the Olympus Give ecosystem where your performance
                is rewarded every 8 hours through the yield your grant generates; you then can also receive support from
                other Ohmies and this acts as a loop that compounds value and amplifies the reach and growth of your
                mission.
              </Trans>
            </Typography>
            <Box className="data-grid">{renderGrants}</Box>
          </div>
          <RecipientModal
            isModalOpen={isCustomGiveModalOpen}
            eventSource="Custom Recipient Button"
            callbackFunc={handleCustomGiveModalSubmit}
            cancelFunc={handleCustomGiveModalCancel}
          />
        </Box>
      </Zoom>
    </div>
  );
}
