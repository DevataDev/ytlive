import { useEffect, useState } from 'react';
import styles from './footer.module.css';
import { fetchFooterInfo } from '@/services/footerService';

export default function Footer() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [versionInfo, setVersionInfo] = useState({ version: '', commit: '', buildTime: '' });
  const [sinceYear, setSinceYear] = useState(2025);

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
      <div className="container mx-auto py-3 px-4">
        <div className="flex flex-col md:flex-row items-center">
          <div className="flex-1 text-center md:text-left mb-2 md:mb-0">
            <div className="flex items-center justify-center md:justify-start">
              <div className="mr-3 flex items-center">
                <i className={`bi bi-broadcast mr-2 text-blue-600 ${styles.broadcastIcon}`}></i>
                <span className={styles.brandText}>Yuk Live!</span>
              </div>
              <div className={`hidden md:block border-l border-gray-300 h-6 ${styles.vr}`}></div>
              <div className="md:ml-3">
                <span className={styles.versionBadge} title={versionInfo.buildTime ? `Build: ${versionInfo.commit}\nDate: ${new Date(versionInfo.buildTime).toLocaleString()}` : ''}>
                  {versionInfo.version ? `v${versionInfo.version} (${versionInfo.commit?.slice(0, 7)})` : 'v0.0.0'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-right">
            <div className={styles.copyrightText}>
              &copy; {sinceYear === currentYear ? sinceYear : `${sinceYear} - ${currentYear}`} PT Jejaring Internet Bersama. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
