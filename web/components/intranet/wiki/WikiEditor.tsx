"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, Image as ImageIcon, Table as TableIcon, Trash2, SplitSquareHorizontal } from 'lucide-react'
import { useState } from 'react'

interface WikiEditorProps {
    content: string
    onChange: (html: string) => void
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) return null

    const addImage = () => {
        const url = window.prompt('URL de l\'image')
        if (url) {
            editor.chain().focus().setImage({ src: url }).run()
        }
    }

    const insertTable = () => {
        const rows = prompt('Nombre de lignes ?', '3')
        const cols = prompt('Nombre de colonnes ?', '3')
        if (rows && cols) {
            editor.chain().focus().insertTable({ rows: parseInt(rows), cols: parseInt(cols), withHeaderRow: true }).run()
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-[#1a1a1a] border-b border-white/10 sticky top-0 z-10">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-2 rounded hover:bg-white/10 ${editor.isActive('bold') ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                title="Gras"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-2 rounded hover:bg-white/10 ${editor.isActive('italic') ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                title="Italique"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded hover:bg-white/10 ${editor.isActive('underline') ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                title="Souligné"
            >
                <UnderlineIcon className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded hover:bg-white/10 ${editor.isActive('heading', { level: 1 }) ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                title="Titre 1"
            >
                <Heading1 className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded hover:bg-white/10 ${editor.isActive('heading', { level: 2 }) ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                title="Titre 2"
            >
                <Heading2 className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-2 rounded hover:bg-white/10 ${editor.isActive('heading', { level: 3 }) ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                title="Titre 3"
            >
                <Heading3 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded hover:bg-white/10 ${editor.isActive('bulletList') ? 'bg-white/20 text-white' : 'text-gray-400'}`}
                title="Liste à puces"
            >
                <List className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <button
                onClick={insertTable}
                className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                title="Insérer un tableau"
            >
                <TableIcon className="w-4 h-4" />
            </button>

            {editor.isActive('table') && (
                <>
                    <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded ml-1 text-gray-400">
                        +Col
                    </button>
                    <button onClick={() => editor.chain().focus().addRowAfter().run()} className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded ml-1 text-gray-400">
                        +Ligne
                    </button>
                    <button onClick={() => editor.chain().focus().deleteTable().run()} className="p-2 rounded hover:bg-red-500/20 text-red-400" title="Supprimer le tableau">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </>
            )}

            <div className="w-px h-6 bg-white/10 mx-1" />

            <button
                onClick={addImage}
                className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                title="Image"
            >
                <ImageIcon className="w-4 h-4" />
            </button>
        </div>
    )
}

export function WikiEditor({ content, onChange }: WikiEditorProps) {
    const [isUploading, setIsUploading] = useState(false)

    // Fonction pour uploader une image vers ImgBB
    const uploadImageToImgBB = async (file: File): Promise<string | null> => {
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/upload/imgbb', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()
            if (result.success && result.url) {
                return result.url
            }
            console.error('ImgBB upload failed:', result)
            return null
        } catch (error) {
            console.error('Upload error:', error)
            return null
        }
    }

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Underline,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'border-collapse table-auto w-full',
                },
            }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: content,
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] p-4 text-sm',
            },
            handlePaste: (view, event, slice) => {
                const items = event.clipboardData?.items
                if (!items) return false

                for (const item of items) {
                    if (item.type.startsWith('image/')) {
                        event.preventDefault()
                        const file = item.getAsFile()
                        if (file) {
                            setIsUploading(true)
                            uploadImageToImgBB(file).then((url) => {
                                setIsUploading(false)
                                if (url && editor) {
                                    editor.chain().focus().setImage({ src: url }).run()
                                }
                            })
                        }
                        return true // Handled
                    }
                }
                return false // Let TipTap handle other pastes
            },
            handleDrop: (view, event, slice, moved) => {
                if (moved) return false

                const files = event.dataTransfer?.files
                if (!files || files.length === 0) return false

                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        event.preventDefault()
                        setIsUploading(true)
                        uploadImageToImgBB(file).then((url) => {
                            setIsUploading(false)
                            if (url && editor) {
                                editor.chain().focus().setImage({ src: url }).run()
                            }
                        })
                        return true
                    }
                }
                return false
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        immediatelyRender: false,
    })

    return (
        <div className="w-full bg-black/50 border border-white/10 rounded-lg overflow-hidden flex flex-col h-full relative">
            {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="flex items-center gap-3 bg-[#1a1a1a] px-4 py-3 rounded-lg border border-white/10">
                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-300">Upload de l'image en cours...</span>
                    </div>
                </div>
            )}
            <MenuBar editor={editor} />
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0f]">
                <EditorContent editor={editor} className="h-full" />
            </div>

            {/* Styles globaux pour les tableaux TipTap pour matcher le look précédent */}
            <style jsx global>{`
                .ProseMirror table {
                    border-collapse: collapse;
                    margin: 0;
                    overflow: hidden;
                    table-layout: fixed;
                    width: 100%;
                }
                .ProseMirror td, .ProseMirror th {
                    border: 1px solid #333;
                    box-sizing: border-box;
                    min-width: 1em;
                    padding: 6px 8px;
                    position: relative;
                    vertical-align: top;
                    background-color: #1a1a1a;
                }
                .ProseMirror th {
                    font-weight: bold;
                    text-align: left;
                    background-color: #252525;
                }
                .ProseMirror .selectedCell:after {
                    background: rgba(200, 200, 255, 0.4);
                    content: "";
                    left: 0; right: 0; top: 0; bottom: 0;
                    pointer-events: none;
                    position: absolute;
                    z-index: 2;
                }
                .ProseMirror p {
                    margin: 0.5em 0;
                }
                .ProseMirror h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    color: white;
                    margin: 0.5em 0;
                    line-height: 1.2;
                }
                .ProseMirror h2 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: white;
                    margin: 0.5em 0;
                    line-height: 1.3;
                }
                .ProseMirror h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: white;
                    margin: 0.5em 0;
                    line-height: 1.4;
                }
            `}</style>
        </div>
    )
}
