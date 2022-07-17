#!/usr/bin/env ts-node
import { CommandLineInterface } from "./CommandLineInterace";
import { setLogLevel } from "./utils";
setLogLevel(1);
new CommandLineInterface(process).run();