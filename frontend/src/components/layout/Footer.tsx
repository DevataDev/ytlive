import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroadcastTower } from '@fortawesome/free-solid-svg-icons';
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
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center justify-center md:justify-start mb-2 md:mb-0">
            <div className="flex items-center mr-3">
              <FontAwesomeIcon 
                icon={faBroadcastTower} 
                className={`mr-2 text-primary ${styles.broadcastIcon}`} 
              />
              <span className={styles.brandText}>Yuk Live!</span>
            </div>
            <div className={`hidden md:block w-px h-6 bg-gray-300 mx-3 ${styles.vr}`}></div>
            <div className="ml-0 md:ml-3">
              <span 
                className={styles.versionBadge} 
                title={versionInfo.buildTime ? `Build: ${versionInfo.commit}\nDate: ${new Date(versionInfo.buildTime).toLocaleString()}` : ''}
              >
                {versionInfo.version ? `${versionInfo.version} (${versionInfo.commit?.slice(0, 7)})` : 'v0.0.0'}
              </span>
            </div>
          </div>
          <div className="text-center md:text-right">
            <div className={styles.copyrightText}>
              &copy; {sinceYear === currentYear ? sinceYear : `${sinceYear} - ${currentYear}`} PT Jejaring Internet Bersama. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
