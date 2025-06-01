import { Container } from 'react-bootstrap';

export default function Footer() {
  return (
    <footer className="bg-light mt-5 py-3">
      <Container>
        <div className="text-center text-muted">
          <p className="mb-0">&copy; {new Date().getFullYear()} YT Live Dashboard. All rights reserved.</p>
          <div className="mt-2">
            <a href="/privacy" className="text-muted me-3">Privacy Policy</a>
            <a href="/terms" className="text-muted">Terms of Service</a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
