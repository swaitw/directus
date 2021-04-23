//import * as util from 'util';
import { GluegunCommand } from 'gluegun';
import yargs, { Argv } from 'yargs';
import yargsParser from 'yargs-parser';

import { Command } from '../command';
import { IEvents } from '../events';
import { IOptions, Option } from '../options';

export type Registrator = (builder: Argv, command: Command, raw: any) => void;

export class Options implements IOptions {
	private _raw: any;
	private _parser: Argv;
	private _parsed?: any;
	private _error?: Error;
	private _registrators: Registrator[];

	constructor(events: IEvents, argv: string[]) {
		this._parser = yargs(argv).help(false).version(false);
		this._registrators = [];
		this._parsed = null;
		this._raw = yargsParser(argv);

		events.on('command.options.register', (command: Command) => {
			const cmd = (command as any) as GluegunCommand;
			const name = cmd.commandPath
				?.concat(...[command.settings?.parameters ?? ''])
				.filter((p) => p != '')
				.join(' ');
			this._parser.fail((_, err) => {
				this._error = err;
			});

			this._parser.showHelpOnFail(false).exitProcess(false);
			this._parser.command(
				name ?? '$0',
				cmd.description ?? '',
				(builder) => {
					for (const registrator of this._registrators) {
						registrator(builder, command, this._raw);
					}
					return this._parser;
				},
				(values) => {
					this._parsed = values;
				}
			);

			this._parser.argv;
		});
	}

	register(registrator: Registrator): void {
		this._registrators.push(registrator);
	}

	feature(name: string, registrator: Registrator): void {
		this._registrators.push((options: Argv, command: Command) => {
			const { settings } = command;
			if (!settings) {
				return;
			}

			const { features } = settings;
			if (!features || !(name in features) || !features[name]) {
				return;
			}

			registrator(options, command, this._raw);
		});
	}

	failed() {
		return !!this._error;
	}

	error() {
		return this._error;
	}

	values() {
		return this._parsed || {};
	}

	list() {
		const freeParser = this._parser as any;
		//const options = freeParser.getOptions();

		const descriptions = freeParser.getUsageInstance().getDescriptions();
		const keys = Object.keys(descriptions);

		return keys.map<Option>((key) => ({
			name: key,
			description: descriptions[key],
			type: 'unknown',
			required: false,
			//default: undefined,
		}));
	}
}
