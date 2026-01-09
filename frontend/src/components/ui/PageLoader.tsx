import { Loader } from './loader';

export const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader size={32} />
  </div>
);
