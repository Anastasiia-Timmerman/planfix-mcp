import { z } from "zod";
import { planfixPost } from "../client.js";

const COMMENT_FIELDS = "id,description,dateTime,owner,task";
const MAX_COMMENTS_PAGE_SIZE = 100;

export const getCommentsSchema = z.object({
  taskId: z.number().describe("ID задачи"),
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество комментариев на странице (по умолчанию 100)"),
});

export async function handleGetComments(params: z.infer<typeof getCommentsSchema>): Promise<string> {
  const pageSize = Math.min(params.pageSize ?? MAX_COMMENTS_PAGE_SIZE, MAX_COMMENTS_PAGE_SIZE);
  const result = await planfixPost(`task/${params.taskId}/comments/list`, {
    offset: params.offset ?? 0,
    pageSize,
    fields: COMMENT_FIELDS,
  });
  return JSON.stringify(result, null, 2);
}

export const addCommentSchema = z.object({
  taskId: z.number().describe("ID задачи"),
  body: z.string().describe("Текст комментария"),
});

export async function handleAddComment(params: z.infer<typeof addCommentSchema>): Promise<string> {
  const result = await planfixPost(`task/${params.taskId}/comments/`, {
    description: params.body,
  });
  return JSON.stringify(result, null, 2);
}
