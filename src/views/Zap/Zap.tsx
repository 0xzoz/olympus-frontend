import "./Zap.scss";

import { Trans } from "@lingui/macro";
import { Box, Typography, Zoom } from "@material-ui/core";
import { Paper } from "@olympusdao/component-library";
import React, { useMemo } from "react";
import { useHistory } from "react-router";
import ConnectButton from "src/components/ConnectButton/ConnectButton";
import { usePathForNetwork } from "src/hooks/usePathForNetwork";
import { useZapTokenBalances } from "src/hooks/useZapTokenBalances";
import { useWeb3Context } from "src/hooks/web3Context";

import ZapInfo from "./ZapInfo";
import ZapStakeAction from "./ZapStakeAction";

const Zap: React.FC = () => {
  const { address, networkId } = useWeb3Context();
  const history = useHistory();
  usePathForNetwork({ pathName: "zap", networkID: networkId, history });

  const zapTokenBalances = useZapTokenBalances();
  const tokens = zapTokenBalances.data?.balances;
  const inputTokenImages = useMemo(() => {
    if (tokens) {
      return Object.entries(tokens)
        .filter(token => token[0] !== "sohm")
        .map(token => token[1].tokenImageUrl)
        .slice(0, 3);
    } else {
      return [];
    }
  }, [tokens]);

  return (
    <div id="zap-view">
      <Zoom in={true}>
        <Paper headerText={address && `Zap`}>
          <div className="staking-area">
            {!address ? (
              <div className="stake-wallet-notification">
                <div className="wallet-menu" id="wallet-menu">
                  <ConnectButton />
                </div>
                <Typography variant="h6">
                  <Trans>Connect your wallet to use Zap</Trans>
                </Typography>
              </div>
            ) : (
              <Box className="stake-action-area">
                <ZapStakeAction />
              </Box>
            )}
          </div>
        </Paper>
      </Zoom>
      <Zoom in={true}>
        <ZapInfo tokens={inputTokenImages} address={address} />
      </Zoom>
    </div>
  );
};

export default Zap;
