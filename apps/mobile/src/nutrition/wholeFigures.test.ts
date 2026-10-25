import { wholeFigure, wholeFigureText } from './wholeFigures';

describe('wholeFigure', () => {
  it('rounds a figure down to its whole number', () => {
    expect(wholeFigure(62.8)).toBe(62);
    expect(wholeFigure(1849.6)).toBe(1849);
    expect(wholeFigure(0.3)).toBe(0);
    expect(wholeFigure(130)).toBe(130);
  });

  it("keeps a figure that's whole but for arithmetic's last digits", () => {
    expect(wholeFigure(0.1 + 0.2 + 2.7)).toBe(3);
    expect(wholeFigure(2.9999999999)).toBe(3);
  });

  it('rounds an amount over or under down by its size, and never shows -0', () => {
    expect(wholeFigure(-350.6)).toBe(-350);
    expect(Object.is(wholeFigure(-0.4), 0)).toBe(true);
  });

  it('separates the thousands for display', () => {
    expect(wholeFigureText(1849.6)).toBe((1849).toLocaleString());
  });
});
