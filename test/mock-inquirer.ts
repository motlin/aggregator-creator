import {createSandbox} from 'sinon';
import * as inquirer from 'inquirer';

const sandbox = createSandbox();

export function mockInquirer() {
	const promptStub = sandbox.stub(inquirer, 'prompt').resolves({confirmed: true});

	return {
		promptStub,
	};
}

export function restoreInquirerMocks() {
	sandbox.restore();
}
