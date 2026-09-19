import React from 'react';

interface Props {
  /** Rendered instead of the scene if it throws (WebGL context lost, shader failure, chunk load error...). */
  fallback: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The landing page must never be a blank screen: any failure in the 3D scene
 * degrades to the CSS gradient behind it rather than unmounting the page.
 */
class SceneBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Landing scene failed, using the gradient fallback:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default SceneBoundary;
