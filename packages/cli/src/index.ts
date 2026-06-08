#!/usr/bin/env node
import {
  runDevCommand,
  runInitCommand,
  runMockCommand,
  runProxyCommand,
  runReplayCommand
} from "./commands.js";

const [, , command, arg] = process.argv;

switch (command) {
  case "dev":
    await runDevCommand();
    break;
  case "init":
    await runInitCommand();
    break;
  case "mock":
    await runMockCommand();
    break;
  case "proxy":
    await runProxyCommand();
    break;
  case "replay":
    await runReplayCommand(arg);
    break;
  default:
    printHelp();
}

function printHelp(): void {
  console.log(`Agent Runtime Inspector

Usage:
  ari dev              Start collector and dashboard
  ari init             Create ari.config.json
  ari mock             Load the sample trace into the running collector
  ari proxy            Start the local MCP proxy for Merge Agent Handler
  ari replay <runId>   Print a dashboard URL for a stored run
`);
}
