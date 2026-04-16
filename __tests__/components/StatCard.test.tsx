/**
 * Tests for StatCard component logic.
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));

import { StatCard } from '../../src/components/StatCard';

function getComponentOutput(element: React.ReactElement): string {
  return JSON.stringify(element, (key, value) => {
    if (key === '_owner' || key === '_store' || key === 'ref' || key === '$$typeof') return undefined;
    return value;
  });
}

describe('StatCard', () => {
  it('renders label and value', () => {
    const element = StatCard({ label: 'Mean HR', value: '72', unit: 'bpm' });
    const output = getComponentOutput(element);
    expect(output).toContain('Mean HR');
    expect(output).toContain('72');
    expect(output).toContain('bpm');
  });

  it('renders without unit', () => {
    const element = StatCard({ label: 'RR Count', value: '350' });
    const output = getComponentOutput(element);
    expect(output).toContain('RR Count');
    expect(output).toContain('350');
  });

  it('renders warning state', () => {
    const element = StatCard({ label: 'Artifacts', value: '8.5%', warning: true });
    const output = getComponentOutput(element);
    expect(output).toContain('Artifacts');
    expect(output).toContain('8.5%');
  });

  it('has accessible label with unit', () => {
    const element = StatCard({ label: 'SDNN', value: '42.3', unit: 'ms' });
    const output = getComponentOutput(element);
    expect(output).toContain('SDNN: 42.3 ms');
  });

  it('has accessible label without unit', () => {
    const element = StatCard({ label: 'Count', value: '500' });
    const output = getComponentOutput(element);
    expect(output).toContain('Count: 500');
  });
});
