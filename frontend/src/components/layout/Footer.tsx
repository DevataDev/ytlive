import { Container } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import styles from './footer.module.css';
import { fetchFooterInfo } from '@/services/footerService';

export default function Footer() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [versionInfo, setVersionInfo] = useState({ version: '', commit: '', buildTime: '' });

  useEffect(() => {
    // Set current year
    setCurrentYear(new Date().getFullYear());

    // You can implement version info fetching here if needed
    fetchFooterInfo().then((info) => {
      setVersionInfo(info);
    });
  }, []);

  return (
    <footer className={`${styles.footer} mt-auto`}>
      <Container className="py-3">
        <div className="row align-items-center">
          <div className="col-md-6 text-center text-md-start mb-2 mb-md-0">
            <div className="d-flex align-items-center justify-content-center justify-content-md-start">
              <div className="me-3 d-flex align-items-center">
                <i className={`bi bi-broadcast me-2 text-primary ${styles.broadcastIcon}`}></i>
                <span className={styles.brandText}>Yuk Live!</span>
              </div>
              <div className={`vr d-none d-md-block ${styles.vr}`}></div>
              <div className="ms-md-3">
                <span className={styles.versionBadge} title={versionInfo.buildTime ? `Build: ${versionInfo.commit}\nDate: ${new Date(versionInfo.buildTime).toLocaleString()}` : ''}>
                  {versionInfo.version ? `v${versionInfo.version} (${versionInfo.commit?.slice(0, 7)})` : 'v0.0.0'}
                </span>
              </div>
            </div>
          </div>
          <div className="col-md-6 text-center text-md-end">
            <div className={styles.copyrightText}>
              &copy; {currentYear} PT Jejaring Internet Bersama. All rights reserved.
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
