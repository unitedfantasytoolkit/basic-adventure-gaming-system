Hooks.on("updateGameTime", (...args) => {
  console.info(game.scenes);
  if (game.scenes) console.info(args);
});
