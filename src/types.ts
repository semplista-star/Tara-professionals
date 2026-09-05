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

export type MessageT = {
  id: string;
  text: string | null;
  attachmentUrl: string | null;
  attachmentType: "IMAGE" | "FILE" | "AUDIO" | null;
  attachmentName: string | null;
  author: UserLite;
  createdAt: string;
};
