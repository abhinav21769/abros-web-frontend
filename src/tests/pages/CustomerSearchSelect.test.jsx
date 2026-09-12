import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerSearchSelect } from '../../pages/Invoices';

const customers = [
  { _id: 'c1', name: 'ARNAV', contact: '8294786523', gstin: '06AHTPG8438L1ZL' },
  { _id: 'c2', name: 'ARNAV MEDICOS', contact: '9000000000' },
  { _id: 'c3', name: 'BHARAT PHARMA', contact: '9111111111' },
];

const openDropdown = async (user, onChange = vi.fn()) => {
  render(
    <CustomerSearchSelect customers={customers} value="" onChange={onChange} />
  );
  await user.click(screen.getByRole('button', { name: /Select customer/i }));
  return { onChange, input: screen.getByPlaceholderText(/Search customer/i) };
};

describe('CustomerSearchSelect keyboard selection', () => {
  it('highlights the first match while typing', async () => {
    const user = userEvent.setup();
    const { input } = await openDropdown(user);

    await user.type(input, 'arnav');

    const options = screen.getAllByRole('button', { name: /ARNAV/ });
    expect(options[0]).toHaveClass('is-active');
    expect(options[1]).not.toHaveClass('is-active');
  });

  it('picks the highlighted match on Enter', async () => {
    const user = userEvent.setup();
    const { onChange, input } = await openDropdown(user);

    await user.type(input, 'arnav{Enter}');

    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'customer', value: 'c1' },
    });
    expect(screen.queryByPlaceholderText(/Search customer/i)).toBeNull();
  });

  it('moves the highlight with the arrow keys', async () => {
    const user = userEvent.setup();
    const { onChange, input } = await openDropdown(user);

    await user.type(input, 'arnav{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'customer', value: 'c2' },
    });
  });

  it('wraps from the first match to the last on ArrowUp', async () => {
    const user = userEvent.setup();
    const { onChange, input } = await openDropdown(user);

    await user.type(input, 'arnav{ArrowUp}{Enter}');

    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'customer', value: 'c2' },
    });
  });

  it('re-highlights the top row when the search changes', async () => {
    const user = userEvent.setup();
    const { onChange, input } = await openDropdown(user);

    // Move off the first row, then narrow the list to a different customer.
    await user.type(input, 'arnav{ArrowDown}');
    await user.clear(input);
    await user.type(input, 'bharat{Enter}');

    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'customer', value: 'c3' },
    });
  });

  it('does nothing on Enter when nothing matches', async () => {
    const user = userEvent.setup();
    const { onChange, input } = await openDropdown(user);

    await user.type(input, 'zzzz{Enter}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/No customer found/i)).toBeInTheDocument();
  });

  it('closes on Escape without selecting', async () => {
    const user = userEvent.setup();
    const { onChange, input } = await openDropdown(user);

    await user.type(input, 'arnav{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/Search customer/i)).toBeNull();
  });
});
