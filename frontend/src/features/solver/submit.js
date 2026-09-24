const performSbcSubmit = (challenge, sbcSet, options = {}) => {
  const runInBackground = !!options?.runInBackground;
  return new Promise((resolve, reject) => {
    services.SBC.submitChallenge(
      challenge,
      sbcSet,
      true,
      services.Chemistry.isFeatureEnabled(),
    ).observe(null, async function (obs, res) {
      obs?.unobserve?.(null);
      try {
        if (!res.success) {
          if (res.error?.code === UtasErrorCode.CHEMISTRY_VERSION_MISMATCH) {
            // Chemistry version out of sync — mirror EA's own recovery then
            // retry once. EA (UTSBCSquadViewController) does exactly:
            //   resetCustomProfiles() -> requestChemistryProfiles()
            //   -> per cached squad: updateChemistry() + update(squad)
            // resetCustomProfiles() zeroes the profile version so the refetch
            // is a real fetch (not NOT_MODIFIED). Both updateChemistry() and
            // update() are synchronous; the previous code wrongly called
            // .observe() on updateChemistry()'s (undefined) return value and
            // skipped update(squad), so chemistry was never actually resynced
            // before the retry submit.
            services.Chemistry.resetCustomProfiles();
            services.Chemistry.requestChemistryProfiles().observe(
              null,
              function (innerObs, _innerRes) {
                innerObs?.unobserve?.(null);

                services.SBC.getCachedSBCSquads().forEach(function (squad) {
                  try {
                    squad.updateChemistry();
                    squad.update(squad);
                  } catch (e) {
                    console.warn("[sbcSubmit] chem resync on retry", e);
                  }
                });

                services.SBC.submitChallenge(
                  challenge,
                  sbcSet,
                  true,
                  services.Chemistry.isFeatureEnabled(),
                ).observe(null, async function (retryObs, retryRes) {
                  retryObs?.unobserve?.(null);
                  if (!retryRes.success) {
                    if (getSettings(0, 0, "playSounds")) wompSound.play();
                    showNotification(
                      "Failed to submit (after chem sync)",
                      UINotificationType.NEGATIVE,
                    );
                    hideLoader();
                    reject(retryRes);
                  } else {
                    showNotification(
                      "SBC Submitted",
                      UINotificationType.POSITIVE,
                    );
                    recordSbcSubmitSuccess();
                    createSBCTab();
                    if (!runInBackground) {
                      goToUnassignedView();
                    }
                    resolve(retryRes);
                  }
                });
              },
            );
          } else {
            if (getSettings(0, 0, "playSounds")) wompSound.play();
            showNotification("Failed to submit", UINotificationType.NEGATIVE);
            hideLoader();
            reject(res);
          }
        } else {
          showNotification("SBC Submitted", UINotificationType.POSITIVE);
          recordSbcSubmitSuccess();
          createSBCTab();
          if (!runInBackground) {
            goToUnassignedView();
          }
          resolve(res);
        }
      } catch (err) {
        console.warn("[sbcSubmit] submit callback error", err);
        reject(err);
      }
    });
  });
};

let sbcSubmit = async function (challenge, sbcSet, options = {}) {
  return new Promise((resolve, reject) => {
    services.Chemistry.requestChemistryProfiles().observe(
      null,
      function (obs, _res) {
        obs?.unobserve?.(null);

        services.SBC.getCachedSBCSquads().forEach(function (squad) {
          try {
            squad.updateChemistry();
            squad.update(squad);
          } catch (e) {
            console.warn("[sbcSubmit] chem update failed", e);
          }
        });

        performSbcSubmit(challenge, sbcSet, options)
          .then(resolve)
          .catch(reject);
      },
    );
  });
};
