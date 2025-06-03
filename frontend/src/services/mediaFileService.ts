import { api } from "@/lib/api";
import { getSession } from "next-auth/react";
import { MediaFile, MediaFileData, MediaListResponse } from "./streamService";
import { getConfig } from "@/lib/config";

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

export const getMediaPreview = (streamId: string, mediaId: string): string => {
  const { apiUrl } = getConfig();
  return `${apiUrl}/api/streams/${streamId}/media/${mediaId}/preview`;
};
