import 'mocha';
import { expect } from 'chai';
import { preprocessMessageBeforeApproval } from './util';

describe('preprocessMessageBeforeApproval', () => {
  it('Returns message if no tag provided', () => {
    expect(preprocessMessageBeforeApproval("Hello world!", undefined)).equals("Hello world!");
  });

  it('Concatenates tag if provided', () => {
    expect(preprocessMessageBeforeApproval("Hello world!", "#example")).equals("Hello world!\n#example");
  });
});
