import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../../context/ToastContext';

function ToastTrigger() {
  const toast = useToast();

  return (
    <div>
      <button onClick={() => toast.success('Operation succeeded!')}>Trigger Success</button>
      <button onClick={() => toast.error('Something failed!')}>Trigger Error</button>
    </div>
  );
}

describe('ToastContext', () => {
  it('renders toasts when triggered and allows dismissing', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByText('Trigger Success'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Operation succeeded!');

    const dismissBtn = screen.getByLabelText('Dismiss');
    await user.click(dismissBtn);

    expect(screen.queryByText('Operation succeeded!')).not.toBeInTheDocument();
  });
});
