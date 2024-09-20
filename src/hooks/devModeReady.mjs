Hooks.once("devModeReady", () => {
  // Only add this script for livereload if we're using Developer Mode
  // (https://github.com/League-of-Foundry-Developers/foundryvtt-devMode)
  const src = `http://${(location.host || "localhost").split(":")[0]}:9999/livereload.js?snipver=1`;
  const script = document.createElement("script");
  script.src = src;

  document.body.appendChild(script);
});
