import { useState } from 'react';

interface UseFfmpegLogsModalReturn {
  showModal: boolean;
  itemId: string;
  itemType: 'stream' | 'mirror';
  openModal: (id: string, type: 'stream' | 'mirror') => void;
  closeModal: () => void;
}

export const useFfmpegLogsModal = (): UseFfmpegLogsModalReturn => {
  const [showModal, setShowModal] = useState(false);
  const [itemId, setItemId] = useState('');
  const [itemType, setItemType] = useState<'stream' | 'mirror'>('stream');

  const openModal = (id: string, type: 'stream' | 'mirror') => {
    setItemId(id);
    setItemType(type);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setItemId('');
  };

  return {
    showModal,
    itemId,
    itemType,
    openModal,
    closeModal
  };
};