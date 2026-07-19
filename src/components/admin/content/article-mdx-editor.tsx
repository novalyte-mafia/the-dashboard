"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import "@mdxeditor/editor/style.css";

const Editor = dynamic(
  async () => {
    const mod = await import("@mdxeditor/editor");
    const {
      MDXEditor,
      headingsPlugin,
      listsPlugin,
      quotePlugin,
      thematicBreakPlugin,
      markdownShortcutPlugin,
      linkPlugin,
      linkDialogPlugin,
      imagePlugin,
      tablePlugin,
      codeBlockPlugin,
      diffSourcePlugin,
      toolbarPlugin,
      DiffSourceToggleWrapper,
      UndoRedo,
      BoldItalicUnderlineToggles,
      BlockTypeSelect,
      CreateLink,
      InsertImage,
      InsertTable,
      ListsToggle,
      Separator,
    } = mod;

    return function ArticleMdxEditorInner({
      markdown,
      onChange,
      readOnly,
    }: {
      markdown: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
    }) {
      return (
        <MDXEditor
          markdown={markdown}
          onChange={onChange}
          readOnly={readOnly}
          className="journal-mdx-editor rounded-md border border-input bg-background"
          contentEditableClassName="prose prose-sm max-w-none min-h-[320px] px-3 py-2 font-sans"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin(),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
            diffSourcePlugin({ viewMode: "rich-text" }),
            toolbarPlugin({
              toolbarContents: () => (
                <DiffSourceToggleWrapper>
                  <UndoRedo />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <BlockTypeSelect />
                  <ListsToggle />
                  <Separator />
                  <CreateLink />
                  <InsertImage />
                  <InsertTable />
                </DiffSourceToggleWrapper>
              ),
            }),
          ]}
        />
      );
    };
  },
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[320px] rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Loading editor…
      </div>
    ),
  },
);

/**
 * Controlled-ish MDX editor. Remounts when `editorKey` changes (article switch /
 * external AI apply) so MDXEditor picks up the new markdown document.
 */
export function ArticleMdxEditor({
  markdown,
  onChange,
  editorKey,
  readOnly,
}: {
  markdown: string;
  onChange: (value: string) => void;
  editorKey: string;
  readOnly?: boolean;
}) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  return (
    <Editor
      key={editorKey}
      markdown={markdown}
      onChange={(value) => latest.current(value)}
      readOnly={readOnly}
    />
  );
}
