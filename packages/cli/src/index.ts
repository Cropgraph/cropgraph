import { Command } from "commander";
import {
  buildCheckCommand,
  buildCompanionsCommand,
  buildPlanCommand,
} from "./commands/companions.js";
import { buildConfigCommand } from "./commands/config.js";
import { buildCropCommand, buildSearchCommand } from "./commands/crop.js";
import {
  buildRotationCheckCommand,
  buildRotationCommand,
} from "./commands/rotation.js";
import {
  buildPestDetailCommand,
  buildPestsCommand,
} from "./commands/pest-disease.js";
import { buildSuccessionCommand } from "./commands/succession.js";
import { buildPlantingCommand, buildZoneCommand } from "./commands/zone.js";

const program = new Command();

program
  .name("cropgraph")
  .description(
    "CropGraph CLI: USDA hardiness zones, frost dates, climate-aware planting plans, 1000-crop calendar, 333 companion relationships, 12 rotation families, 33 succession chains, and 158 pest/disease associations.",
  )
  .version("1.3.0");

program.addCommand(buildZoneCommand());
program.addCommand(buildPlantingCommand());
program.addCommand(buildCropCommand());
program.addCommand(buildSearchCommand());
program.addCommand(buildCompanionsCommand());
program.addCommand(buildCheckCommand());
program.addCommand(buildPlanCommand());
program.addCommand(buildRotationCommand());
program.addCommand(buildRotationCheckCommand());
program.addCommand(buildSuccessionCommand());
program.addCommand(buildPestsCommand());
program.addCommand(buildPestDetailCommand());
program.addCommand(buildConfigCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`cropgraph: ${message}\n`);
  process.exit(1);
});
