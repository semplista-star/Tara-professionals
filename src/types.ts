export type UserLite = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
};

export type CommentT = {
  id: string;
  text: string;
  author: UserLite;
  createdAt: string;
};

export type TaskT = {
  id: string;
  title: string;
  description: string | null;
  status: "PENDENT" | "CURS" | "FET";
  priority: "ALTA" | "MITJA" | "BAIXA";
  dueDate: string | null;
  assignee: UserLite | null;
  creator: UserLite;
  comments: CommentT[];
  createdAt: string;
};

export type PersonalFileT = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  createdAt: string;
};

export type MeetingT = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  durationMinutes: number;
  creator: UserLite;
  participants: UserLite[];
  createdAt: string;
};

export type MessageT = {
  id: string;
  text: string | null;
  attachmentUrl: string | null;
  attachmentType: "IMAGE" | "FILE" | "AUDIO" | null;
  attachmentName: string | null;
  author: UserLite;
  createdAt: string;
};
