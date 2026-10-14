import { API_URL } from "./api-url";

export type Article = {
  id: string;
  category: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ArticleSummary = Omit<Article, "content">;
export type ArticleInput = Pick<
  Article,
  "category" | "title" | "description" | "content" | "coverImageUrl"
>;

async function articleRequest<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${API_URL}/api/articles${path}`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "Không thể tải bài viết";
    throw new Error(message);
  }
  return body as T;
}

export function fetchPublishedArticles(accessToken: string) {
  return articleRequest<ArticleSummary[]>("", accessToken);
}

export function fetchArticle(accessToken: string, slug: string) {
  return articleRequest<Article>(`/${encodeURIComponent(slug)}`, accessToken);
}

async function managementRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : options.body
          ? { "Content-Type": "application/json" }
          : {}),
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "Không thể thực hiện thao tác với bài viết";
    throw new Error(message);
  }
  return body as T;
}

export function fetchManagedArticles(accessToken: string) {
  return managementRequest<Article[]>("/articles/manage", accessToken);
}

export function saveArticle(
  accessToken: string,
  input: ArticleInput,
  id?: string,
) {
  return managementRequest<Article>(
    `/articles/manage${id ? `/${id}` : ""}`,
    accessToken,
    {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateArticlePublication(
  accessToken: string,
  id: string,
  published: boolean,
) {
  return managementRequest<Article>(
    `/articles/manage/${id}/${published ? "publish" : "unpublish"}`,
    accessToken,
    { method: "POST" },
  );
}

export function deleteArticle(accessToken: string, id: string) {
  return managementRequest<{ message: string }>(
    `/articles/manage/${id}`,
    accessToken,
    {
      method: "DELETE",
    },
  );
}

export async function uploadArticleImage(accessToken: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const result = await managementRequest<{ url: string }>(
    "/uploads/article-image",
    accessToken,
    {
      method: "POST",
      body,
    },
  );
  return result.url;
}
