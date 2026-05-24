import { describe, expect, it } from 'vitest';
import { commandBus } from '../CommandBus';

describe('CommandBus.drain', () => {
  it('does not replay the previous tick when no commands are queued', () => {
    // clear any previous singleton state
    commandBus.drain();

    commandBus.dispatch({ type: 'E_STOP' });
    const first = commandBus.drain();
    expect(first.map((cmd) => cmd.type)).toEqual(['E_STOP']);

    const second = commandBus.drain();
    expect(second).toHaveLength(0);
  });
});
