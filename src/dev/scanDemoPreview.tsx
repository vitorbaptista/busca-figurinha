// Dev-only: renders just the onboarding ScanDemo on the album-green field, so the looping demo can
// be reviewed at /scan-demo.html without going through onboarding. Not part of the build (the build
// input is pinned to index.html).
import { render } from 'preact';
import '../styles.css';
import { ScanDemo } from '../ui/components/ScanDemo';

render(<ScanDemo />, document.getElementById('app')!);
