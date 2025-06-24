import { api } from "@/lib/api";
import { getSession } from "next-auth/react";
import { MediaFile, MediaFileData, MediaListResponse } from "./streamService";

export interface MediaFileUploadData {
  file: File;
  mediaType: "video" | "audio" | "image";
}

export const fetchMediaFiles = async (
  streamId: string
): Promise<MediaListResponse> => {
  const session = await getSession();
  const response = await api.get<MediaListResponse>(
    `/api/streams/${streamId}/media`,
    {
      headers: { Authorization: `Bearer ${session?.user?.backendToken}` },
    }
  );
  return response;
};

export const uploadMediaFile = async (
  streamId: string,
  data: MediaFileUploadData
): Promise<MediaFileData> => {
  const session = await getSession();
  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("media_type", data.mediaType);
  formData.append("stream_id", streamId);

  const response = await api.post<MediaFileData>(
    `/api/streams/${streamId}/media`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${session?.user?.backendToken}`,
      },
    }
  );

  return response;
};

export const deleteMediaFile = async (fileId: string): Promise<void> => {
  const session = await getSession();
  await api.delete(`/api/streams/media/${fileId}`, {
    headers: { Authorization: `Bearer ${session?.user?.backendToken}` },
  });
};

export const deleteMapMediaFile = async (streamId: string, fileId: string): Promise<void> => {
    const session = await getSession();
    await api.put(`/api/streams/${streamId}/media/${fileId}/unmap`, null, {
      headers: { Authorization: `Bearer ${session?.user?.backendToken}` },
    });
  };

export const getMediaPreview = (apiUrl: string, streamId: string, mediaId: string): string => {
  return `${apiUrl}/api/streams/${streamId}/media/${mediaId}/preview`;
};

// Add to mediaFileService.ts
export interface UserMediaFilesResponse {
  files: MediaFile[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export const fetchAllUserMediaFiles = async (
  limit = 20,
  offset = 0,
  type: 'video' | 'audio' | 'image' = 'video'
): Promise<UserMediaFilesResponse> => {
  const session = await getSession();
  const response = await api.get<UserMediaFilesResponse>(
    `/api/media/user?limit=${limit}&offset=${offset}&type=${type}`,
    {
      headers: { Authorization: `Bearer ${session?.user?.backendToken}` },
    }
  );
  return response;
};

export const uploadUserMediaFiles = async (
  files: File[]
): Promise<{ success: boolean; message: string }> => {
  const session = await getSession();
  const formData = new FormData();
  
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await api.post<{ success: boolean; message: string }>(
    '/api/media/upload',
    formData,
    {
      headers: {
        Authorization: `Bearer ${session?.user?.backendToken}`,
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response;
};

export const renameMediaFile = async (
  fileId: string,
  fileName: string
): Promise<{ message: string; file: MediaFile }> => {
  const session = await getSession();
  const response = await api.put<{ message: string; file: MediaFile }>(
    `/api/media/${fileId}/rename`,
    { file_name: fileName },
    {
      headers: { Authorization: `Bearer ${session?.user?.backendToken}` },
    }
  );
  return response;
};
