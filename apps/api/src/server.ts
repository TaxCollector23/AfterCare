import { createApp } from "./app.js";
import { config } from "./config.js";

createApp().listen(config.PORT, () => {
  console.log(`DischargeGuide API listening on http://localhost:${config.PORT}`);
});
