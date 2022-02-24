import "react-step-progress-bar/styles.css";
// We import this AFTER the styles for react-step-progress-bar, so that we can override it
import "./GrantCard.scss";

import { t, Trans } from "@lingui/macro";
import { Box, Container, Grid, Link, SvgIcon, Typography } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import { ChevronLeft } from "@material-ui/icons";
import { Skeleton } from "@material-ui/lab";
import { Icon, Paper, PrimaryButton } from "@olympusdao/component-library";
import { BigNumber } from "bignumber.js";
import MarkdownIt from "markdown-it";
import { useEffect, useState } from "react";
import ReactGA from "react-ga";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { ProgressBar, Step } from "react-step-progress-bar";
import { ReactComponent as CurrentMilestone } from "src/assets/icons/current-milestone.svg";
import { ReactComponent as Donors } from "src/assets/icons/donors.svg";
import { ReactComponent as GiveSohm } from "src/assets/icons/give_sohm.svg";
import { ReactComponent as Heart } from "src/assets/icons/heart.svg";
import { ReactComponent as MilestoneAmount } from "src/assets/icons/milestone-amount.svg";
import { NetworkId } from "src/constants";
import { EnvHelper } from "src/helpers/Environment";
import { getTotalDonated } from "src/helpers/GetTotalDonated";
import { getDonorNumbers, getRedemptionBalancesAsync } from "src/helpers/GiveRedemptionBalanceHelper";
import { useAppDispatch } from "src/hooks";
import { useWeb3Context } from "src/hooks/web3Context";
import { IAccountSlice } from "src/slices/AccountSlice";
import { IAppData } from "src/slices/AppSlice";
import {
  ACTION_GIVE,
  ACTION_GIVE_EDIT,
  ACTION_GIVE_WITHDRAW,
  changeGive,
  changeMockGive,
  isSupportedChain,
} from "src/slices/GiveThunk";
import { IPendingTxn } from "src/slices/PendingTxnsSlice";
import { CancelCallback, SubmitCallback } from "src/views/Give/Interfaces";
import { ManageDonationModal, WithdrawSubmitCallback } from "src/views/Give/ManageDonationModal";
import { RecipientModal } from "src/views/Give/RecipientModal";

import { error } from "../../slices/MessagesSlice";
import { Grant } from "./project.type";

export enum GrantDetailsMode {
  Card = "Card",
  Page = "Page",
}

type GrantDetailsProps = {
  grant: Grant;
  mode: GrantDetailsMode;
};

type State = {
  account: IAccountSlice;
  pendingTransactions: IPendingTxn[];
  app: IAppData;
};

export default function GrantCard({ grant, mode }: GrantDetailsProps) {
  const location = useLocation();
  const { provider, address, connected, connect, networkId } = useWeb3Context();
  const {
    title,
    owner,
    shortDescription,
    details,
    finishDate,
    photos,
    wallet,
    depositGoal,
    milestones,
    latestMilestoneCompleted,
  } = grant;
  const [recipientInfoIsLoading, setRecipientInfoIsLoading] = useState(true);
  const [donorCountIsLoading, setDonorCountIsLoading] = useState(true);
  const [totalDebt, setTotalDebt] = useState("");
  const [totalDonated, setTotalDonated] = useState("");
  const [donorCount, setDonorCount] = useState(0);
  const [isUserDonating, setIsUserDonating] = useState(false);
  const [donationId, setDonationId] = useState(0);

  const [isGiveModalOpen, setIsGiveModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const donationInfo = useSelector((state: State) => {
    return networkId === NetworkId.TESTNET_RINKEBY && EnvHelper.isMockSohmEnabled(location.search)
      ? state.account.mockGiving && state.account.mockGiving.donationInfo
      : state.account.giving && state.account.giving.donationInfo;
  });

  const theme = useTheme();

  // We use useAppDispatch here so the result of the AsyncThunkAction is typed correctly
  // See: https://stackoverflow.com/a/66753532
  const dispatch = useAppDispatch();

  const svgFillColour: string = theme.palette.type === "light" ? "black" : "white";

  useEffect(() => {
    const items = document.getElementsByClassName("project-container");
    if (items.length > 0) {
      items[0].scrollIntoView();
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  useEffect(() => {
    // We use dispatch to asynchronously fetch the results, and then update state variables so that the component refreshes
    // We DO NOT use dispatch here, because it will overwrite the state variables in the redux store, which then creates havoc
    // e.g. the redeem yield page will show someone else's deposited sOHM and redeemable yield
    getRedemptionBalancesAsync({
      networkID: networkId,
      provider: provider,
      address: wallet,
    })
      .then(resultAction => {
        setTotalDebt(resultAction.redeeming.recipientInfo.totalDebt);
        setRecipientInfoIsLoading(false);
      })
      .catch(e => console.log(e));

    getDonorNumbers({
      networkID: networkId,
      provider: provider,
      address: wallet,
    })
      .then(resultAction => {
        setDonorCount(!resultAction ? 0 : resultAction.length);
        setDonorCountIsLoading(false);
      })
      .catch(e => console.log(e));

    getTotalDonated({
      networkID: networkId,
      provider: provider,
      address: wallet,
    })
      .then(donatedAmount => {
        setTotalDonated(donatedAmount);
      })
      .catch(e => console.log(e));
  }, [connected, networkId, isGiveModalOpen]);

  useEffect(() => {
    for (let i = 0; i < donationInfo.length; i++) {
      if (donationInfo[i].recipient.toLowerCase() === wallet.toLowerCase()) {
        setIsUserDonating(true);
        setDonationId(i);
        break;
      }
    }
  }, [donationInfo]);

  useEffect(() => {
    setIsUserDonating(false);
    setDonationId(0);
  }, [networkId]);

  /**
   * Returns the milestone completion:
   * - 0: no milestones completed
   * - Otherwise, the completed milestone is indexed from 1
   */
  const getLatestMilestoneCompleted = (): number => {
    return !latestMilestoneCompleted ? 0 : latestMilestoneCompleted;
  };

  const getLatestMilestoneCompletedSafe = (): number => {
    if (!milestones) return 0;

    return getLatestMilestoneCompleted() >= milestones.length ? milestones.length - 1 : getLatestMilestoneCompleted();
  };

  const getLatestMilestoneAmount = (): number => {
    if (!milestones) return 0;

    return milestones[getLatestMilestoneCompletedSafe()].amount;
  };

  const renderMilestoneCompletion = (): JSX.Element => {
    if (milestones === undefined || milestones.length === 0) {
      return <Typography>No milestones are defined for this grant.</Typography>;
    }

    // Expects a percentage between 0 and 100
    // Examples for 2 milestones:
    // Start: getLatestMilestoneCompleted() = 0, percentComplete should equal 0
    // Milestone 1 complete: getLatestMilestoneCompleted() = 1, percentComplete should equal 50
    const percentComplete = (100 * getLatestMilestoneCompleted()) / milestones.length;
    const accomplishedStyle = {
      color: `${theme.palette.text.primary}`,
    };
    const unaccomplishedStyle = {
      color: `${theme.palette.text.secondary}`,
    };

    return (
      <>
        <div className={`project-milestone-progress`}>
          <ProgressBar
            percent={percentComplete}
            unfilledBackground="rgb(172, 177, 185)"
            filledBackground="linear-gradient(269deg, rgba(112, 139, 150, 1) 0%, rgba(247, 251, 231, 1) 100%)"
          >
            {milestones.map((value, index) => {
              const humanIndex: number = index + 1;
              const currentMilestonePercentage: number = (100 * humanIndex) / milestones.length;
              const milestoneAccomplished: boolean = percentComplete >= currentMilestonePercentage;

              return (
                <Step key={`step-${humanIndex}`}>
                  {({}) => (
                    <div
                      className="step-label"
                      style={milestoneAccomplished ? accomplishedStyle : unaccomplishedStyle}
                    >{`Milestone ${humanIndex}`}</div>
                  )}
                </Step>
              );
            })}
            {
              // We add a dummy step at the end, so that steps are left-aligned
              <Step key={`step-${milestones.length + 1}`}>{({}) => <></>}</Step>
            }
          </ProgressBar>
        </div>
      </>
    );
  };

  /**
   * Returns the details of the next milestone.
   *
   * If the last milestone has been completed, display that.
   */
  const renderMilestoneDetails = (): JSX.Element => {
    if (milestones === undefined || milestones.length === 0) {
      return <></>;
    }

    const milestoneSafe = getLatestMilestoneCompletedSafe();
    const currentMilestoneDetails = milestones[milestoneSafe];

    return (
      <div
        dangerouslySetInnerHTML={{ __html: MarkdownIt({ html: true }).render(currentMilestoneDetails.description) }}
        className="milestone-deliverables"
      />
    );
  };

  const renderDepositData = (): JSX.Element => {
    const totalMilestoneAmount: BigNumber = !milestones
      ? new BigNumber(0)
      : milestones.reduce((total, value) => total.plus(value.amount), new BigNumber(0));

    return (
      <>
        <Grid container className="grant-data" spacing={3} alignItems="flex-end">
          <Grid item xs={5}>
            <Grid container direction="column" alignItems="flex-start">
              <Grid item>
                <Grid container justifyContent="flex-start" alignItems="center">
                  <Grid item>
                    <SvgIcon component={Donors} />
                  </Grid>
                  <Grid item className="metric">
                    {donorCountIsLoading ? <Skeleton /> : donorCount}
                  </Grid>
                </Grid>
              </Grid>
              <Grid item className="subtext">
                <Trans>Donors</Trans>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={7}>
            <Grid container direction="column" alignItems="flex-end">
              <Grid item>
                <Grid container justifyContent="flex-end" alignItems="center">
                  <Grid item>
                    <SvgIcon viewBox="0 0 18 18" component={MilestoneAmount} />
                  </Grid>
                  <Grid item className="metric">
                    {totalMilestoneAmount.toFixed(0)}
                  </Grid>
                </Grid>
              </Grid>
              <Grid item className="subtext">
                <Trans>Total Milestone Amount</Trans>
              </Grid>
            </Grid>
          </Grid>
          <Box width="100%" />
          <Grid item xs={5}>
            <Grid container direction="column" alignItems="flex-start">
              <Grid item>
                <Grid container justifyContent="flex-start" alignItems="center">
                  <Grid item>
                    <SvgIcon viewBox="0 0 18 18" component={CurrentMilestone} />
                  </Grid>
                  <Grid item className="metric">
                    {getLatestMilestoneCompleted()}
                  </Grid>
                </Grid>
              </Grid>
              <Grid item className="subtext">
                <Trans>Current Milestone</Trans>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={7}>
            <Grid container direction="column" alignItems="flex-end">
              <Grid item>
                <Grid container justifyContent="flex-end" alignItems="center">
                  <Grid item>
                    <SvgIcon component={Heart} />
                  </Grid>
                  <Grid item className="metric">
                    {getLatestMilestoneAmount()}
                  </Grid>
                </Grid>
              </Grid>
              <Grid item className="subtext">
                <Trans>Current Milestone Amount</Trans>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </>
    );
  };

  const getProjectImage = (): JSX.Element => {
    // We return an empty image with a set width, so that the spacing remains the same.
    if (!photos || photos.length < 1)
      return (
        <div className="grant-image">
          <img height="100%" src="" />
        </div>
      );

    // For the moment, we only display the first photo
    return (
      <div className="grant-image">
        <Link href={`#/give/grants/${grant.slug}`} onClick={() => handleGrantDetailsButtonClick("Image")}>
          <img width="100%" src={`${process.env.PUBLIC_URL}${photos[0]}`} />
        </Link>
      </div>
    );
  };

  const handleGiveButtonClick = () => {
    setIsGiveModalOpen(true);
  };

  const handleEditButtonClick = () => {
    setIsManageModalOpen(true);
  };

  const handleGiveModalSubmit: SubmitCallback = async (
    walletAddress: string,
    eventSource: string,
    depositAmount: BigNumber,
  ) => {
    if (depositAmount.isEqualTo(new BigNumber(0))) {
      return dispatch(error(t`Please enter a value!`));
    }

    // If on Rinkeby and using Mock Sohm, use changeMockGive async thunk
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
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
          eventSource: eventSource,
        }),
      );
    }

    setIsGiveModalOpen(false);
  };

  const handleGiveModalCancel: CancelCallback = () => {
    setIsGiveModalOpen(false);
  };

  const handleEditModalSubmit: SubmitCallback = async (
    walletAddress,
    eventSource,
    depositAmount,
    depositAmountDiff,
  ) => {
    if (!depositAmountDiff) {
      return dispatch(error(t`Please enter a value!`));
    }

    if (depositAmountDiff.isEqualTo(new BigNumber(0))) return;

    // If on Rinkeby and using Mock Sohm, use changeMockGive async thunk
    // Else use standard call
    if (networkId === NetworkId.TESTNET_RINKEBY && EnvHelper.isMockSohmEnabled(location.search)) {
      await dispatch(
        changeMockGive({
          action: ACTION_GIVE_EDIT,
          value: depositAmountDiff.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
          eventSource,
        }),
      );
    } else {
      await dispatch(
        changeGive({
          action: ACTION_GIVE_EDIT,
          value: depositAmountDiff.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
          eventSource,
        }),
      );
    }

    setIsManageModalOpen(false);
  };

  const handleWithdrawModalSubmit: WithdrawSubmitCallback = async (walletAddress, eventSource, depositAmount) => {
    // If on Rinkeby and using Mock Sohm, use changeMockGive async thunk
    // Else use standard call
    if (networkId === NetworkId.TESTNET_RINKEBY && EnvHelper.isMockSohmEnabled(location.search)) {
      await dispatch(
        changeMockGive({
          action: ACTION_GIVE_WITHDRAW,
          value: depositAmount.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
          eventSource,
        }),
      );
    } else {
      await dispatch(
        changeGive({
          action: ACTION_GIVE_WITHDRAW,
          value: depositAmount.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
          eventSource,
        }),
      );
    }

    setIsManageModalOpen(false);
  };

  const handleManageModalCancel = () => {
    setIsManageModalOpen(false);
  };

  const getTitle = () => {
    if (!owner) return title;

    return owner + " - " + title;
  };

  const getRenderedDetails = (shorten: boolean) => {
    return {
      __html: MarkdownIt({ html: true }).render(shorten ? `${shortDescription}` : `${details}`),
    };
  };

  /**
   * Handles the onClick event for the project details button.
   *
   * Primarily, this will record the event in Google Analytics.
   */
  const handleGrantDetailsButtonClick = (source: string) => {
    ReactGA.event({
      category: "Olympus Give",
      action: "View Grants Project",
      label: title,
      dimension1: address ?? "unknown",
      dimension2: source,
    });
  };

  const getCardContent = () => {
    return (
      <>
        <Box style={{ width: "100%", borderRadius: "10px" }}>
          <Grid container key={title} spacing={3}>
            <Grid item xs={12}>
              <Link href={`#/give/grants/${grant.slug}`} onClick={() => handleGrantDetailsButtonClick("Title Link")}>
                <Typography variant="h4">
                  <strong>{getTitle()}</strong>
                </Typography>
              </Link>
            </Grid>
            <Grid item xs={12} md={12} lg={4}>
              {getProjectImage()}
            </Grid>
            <Grid item container xs alignContent="space-between">
              <Grid item xs={12}>
                <Typography variant="body1" style={{ lineHeight: "20px" }}>
                  <div dangerouslySetInnerHTML={getRenderedDetails(true)} />
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Grid container>
                  <Grid item xs />
                  <Grid item xs={12} lg={4}>
                    <Link
                      href={`#/give/grants/${grant.slug}`}
                      className="cause-link"
                      onClick={() => handleGrantDetailsButtonClick("View Details Button")}
                    >
                      <PrimaryButton fullWidth>
                        <Trans>View Details</Trans>
                      </PrimaryButton>
                    </Link>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Box>
        <RecipientModal
          isModalOpen={isGiveModalOpen}
          eventSource="Grants List"
          callbackFunc={handleGiveModalSubmit}
          cancelFunc={handleGiveModalCancel}
          project={grant}
          key={title}
        />
      </>
    );
  };

  const getPageContent = () => {
    return (
      <>
        <Container className={`project-container`}>
          <Grid container className="project" spacing={3} alignItems="flex-start">
            <Grid container item xs={12} lg={5}>
              <Grid item xs={12}>
                <Paper
                  topLeft={
                    <Grid container spacing={2} alignItems="center">
                      <Grid item>
                        <Link href={"#/give/grants"}>
                          <ChevronLeft
                            className="back-to-causes"
                            viewBox="6 6 12 12"
                            style={{ width: "12px", height: "12px" }}
                          />
                        </Link>
                      </Grid>
                      <Grid item>
                        <Typography variant="h5">{getTitle()}</Typography>
                      </Grid>
                    </Grid>
                  }
                >
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4} lg={12}>
                      {getProjectImage()}
                    </Grid>
                    <Grid item container xs>
                      <Grid item xs={12}>
                        {renderDepositData()}
                      </Grid>
                      <Grid item xs={12} style={{ paddingTop: "24px" }}>
                        {!connected ? (
                          <PrimaryButton onClick={connect} fullWidth>
                            <Trans>Connect Wallet</Trans>
                          </PrimaryButton>
                        ) : isUserDonating ? (
                          <></>
                        ) : (
                          <PrimaryButton
                            onClick={() => handleGiveButtonClick()}
                            disabled={!isSupportedChain(networkId)}
                            fullWidth
                          >
                            <Trans>Donate Yield</Trans>
                          </PrimaryButton>
                        )}
                      </Grid>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                {!isUserDonating ? (
                  <></>
                ) : (
                  <Paper className="project-sidebar" headerText={t`Your Donations`}>
                    <Grid container alignItems="flex-end">
                      <Grid item xs={6}>
                        <Grid container direction="column" alignItems="flex-start">
                          <Grid item container justifyContent="flex-start" alignItems="center">
                            <Grid item>
                              <SvgIcon component={GiveSohm} />
                            </Grid>
                            <Grid item>
                              <Typography className="metric">
                                {t`${
                                  donationInfo[donationId]
                                    ? parseFloat(donationInfo[donationId].deposit).toFixed(2)
                                    : "0"
                                } sOHM`}
                              </Typography>
                            </Grid>
                          </Grid>
                          <Grid item className="subtext">
                            <Trans>Deposited</Trans>
                          </Grid>
                        </Grid>
                      </Grid>
                      <Grid item xs={6}>
                        <Grid container direction="column" alignItems="flex-end">
                          <Grid item>
                            <Grid container justifyContent="flex-end" alignItems="center">
                              <Grid item>
                                <SvgIcon component={GiveSohm} />
                              </Grid>
                              <Grid item>
                                <Typography className="metric">
                                  {t`${
                                    donationInfo[donationId]
                                      ? parseFloat(donationInfo[donationId].yieldDonated).toFixed(2)
                                      : "0"
                                  } sOHM`}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Grid>
                          <Grid item className="subtext">
                            <Trans>Yield Sent</Trans>
                          </Grid>
                        </Grid>
                      </Grid>
                      <Box width="100%" />
                      <Grid item xs={12}>
                        <PrimaryButton
                          onClick={() => handleEditButtonClick()}
                          disabled={!isSupportedChain(networkId)}
                          style={{ marginTop: "24px" }}
                          fullWidth
                        >
                          <Trans>Edit Donation</Trans>
                        </PrimaryButton>
                      </Grid>
                    </Grid>
                  </Paper>
                )}
              </Grid>
            </Grid>
            <Grid container item xs={12} lg={7}>
              <Grid item xs={12}>
                <Paper headerText="Milestone">
                  {renderMilestoneCompletion()}
                  {renderMilestoneDetails()}
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper
                  headerText="About"
                  topRight={
                    <Link href={grant.website} target="_blank">
                      <Icon name="website" fill={svgFillColour} />
                    </Link>
                  }
                >
                  <div className="project-content" dangerouslySetInnerHTML={getRenderedDetails(false)} />
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Container>
        <RecipientModal
          isModalOpen={isGiveModalOpen}
          eventSource="Grant Details"
          callbackFunc={handleGiveModalSubmit}
          cancelFunc={handleGiveModalCancel}
          project={grant}
          key={title}
        />

        {isUserDonating ? (
          <ManageDonationModal
            isModalOpen={isManageModalOpen}
            eventSource={"Grant Details"}
            submitEdit={handleEditModalSubmit}
            submitWithdraw={handleWithdrawModalSubmit}
            cancelFunc={handleManageModalCancel}
            currentWalletAddress={donationInfo[donationId].recipient}
            currentDepositAmount={new BigNumber(donationInfo[donationId].deposit)}
            depositDate={donationInfo[donationId].date}
            yieldSent={donationInfo[donationId].yieldDonated}
            project={grant}
            key={"manage-modal-" + donationInfo[donationId].recipient}
          />
        ) : (
          <></>
        )}
      </>
    );
  };

  if (mode == GrantDetailsMode.Card) return getCardContent();
  else return getPageContent();
}