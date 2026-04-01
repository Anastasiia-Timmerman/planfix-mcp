import { z } from "zod";
import { planfixPost, planfixGet } from "../client.js";

export const getContactsSchema = z.object({
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество контактов на странице (по умолчанию 100)"),
  filterId: z.number().optional().describe("ID фильтра контактов"),
});

export async function handleGetContacts(params: z.infer<typeof getContactsSchema>): Promise<string> {
  const result = await planfixPost("contact/list", {
    offset: params.offset ?? 0,
    pageSize: params.pageSize ?? 100,
    ...(params.filterId ? { filterId: params.filterId } : {}),
  });
  return JSON.stringify(result, null, 2);
}

export const getContactSchema = z.object({
  contactId: z.number().describe("ID контакта"),
});

export async function handleGetContact(params: z.infer<typeof getContactSchema>): Promise<string> {
  const result = await planfixGet(`contact/${params.contactId}`);
  return JSON.stringify(result, null, 2);
}
