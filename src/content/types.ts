export type SiteMeta = { name: string };

export type PageMeta = {
    title: string;
    description?: string;
    date?: string;
    slug?: string;
    draft?: boolean;
    template?: string;
};

export type PostSummary = {
    route: string;
    title: string;
    description?: string;
    date: string;
};

export type ContentNode =
    | { kind: "text"; value: string }
    | {
          kind: "element";
          tag: string;
          props: Record<string, string>;
          children: ContentNode[];
      }
    | { kind: "directive"; name: string; children: ContentNode[] };

export type TemplateName = "home" | "page" | "post" | "blogIndex";

export type RouteEntry = {
    path: string;
    template: TemplateName;
    meta: PageMeta;
    body: ContentNode[];
};
