import "./Give.scss";

import { t, Trans } from "@lingui/macro";
import { Container, Grid, Typography, Zoom } from "@material-ui/core";
import { Paper, TertiaryButton } from "@olympusdao/component-library";
import { useEffect, useMemo, useState } from "react";
import { useUIDSeed } from "react-uid";
import ProjectCard, { ProjectDetailsMode } from "src/components/GiveProject/ProjectCard";
import { DecimalBigNumber } from "src/helpers/DecimalBigNumber/DecimalBigNumber";
import { useAppDispatch } from "src/hooks";
import { useWeb3Context } from "src/hooks/web3Context";
import { CancelCallback, SubmitCallback } from "src/views/Give/Interfaces";
import { RecipientModal } from "src/views/Give/RecipientModal";

import { error } from "../../slices/MessagesSlice";
import { useGive } from "./hooks/useGive";
import data from "./projects.json";

export default function CausesDashboard() {
  const { address } = useWeb3Context();
  const [isCustomGiveModalOpen, setIsCustomGiveModalOpen] = useState(false);
  const { projects } = data;

  const giveMutation = useGive();

  const isMutating = giveMutation.isLoading;

  useEffect(() => {
    if (isCustomGiveModalOpen) setIsCustomGiveModalOpen(false);
  }, [giveMutation.isSuccess]);

  // We use useAppDispatch here so the result of the AsyncThunkAction is typed correctly
  // See: https://stackoverflow.com/a/66753532
  const dispatch = useAppDispatch();
  const seed = useUIDSeed();

  const renderProjects = useMemo(() => {
    return projects.map(project => {
      return (
        <>
          <Grid item xs={12}>
            <ProjectCard key={seed(project.title)} project={project} mode={ProjectDetailsMode.Card} />
          </Grid>
        </>
      );
    });
  }, [projects]);

  const handleCustomGiveButtonClick = () => {
    setIsCustomGiveModalOpen(true);
  };

  const handleCustomGiveModalSubmit: SubmitCallback = async (
    walletAddress: string,
    eventSource: string,
    depositAmount: DecimalBigNumber,
  ) => {
    if (depositAmount.eq(new DecimalBigNumber("0"))) {
      return dispatch(error(t`Please enter a value!`));
    }

    const amount = depositAmount.toString();
    await giveMutation.mutate({ amount: amount, recipient: walletAddress });
  };

  const handleCustomGiveModalCancel: CancelCallback = () => {
    setIsCustomGiveModalOpen(false);
  };

  return (
    <Zoom in={true}>
      <Container>
        <Grid container justifyContent="center" alignItems="center" spacing={4}>
          {renderProjects}
          <Grid item xs={12}>
            <Paper fullWidth>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h4" align="center">
                    <Trans>Want to give to a different cause?</Trans>
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" align="center">
                    <Trans>You can direct your yield to a recipient of your choice</Trans>
                  </Typography>
                </Grid>
                <Grid item xs={12} container justifyContent="center">
                  <TertiaryButton onClick={() => handleCustomGiveButtonClick()} disabled={!address}>
                    <Trans>Custom Recipient</Trans>
                  </TertiaryButton>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
        <RecipientModal
          isModalOpen={isCustomGiveModalOpen}
          isMutationLoading={isMutating}
          eventSource="Custom Recipient Button"
          callbackFunc={handleCustomGiveModalSubmit}
          cancelFunc={handleCustomGiveModalCancel}
        />
      </Container>
    </Zoom>
  );
}
