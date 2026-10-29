import { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Called once when a child throws (for example, the 3D chunk fails to load). */
  onError: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/** Keeps a failure in an optional visual from taking the whole page down. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
