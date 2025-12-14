"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, X, Loader2, Image } from "lucide-react";

interface FileUploadProps {
    label: string;
    type: "id_card" | "driving_license" | "weapon_permit";
    applicationId?: string;
    required?: boolean;
    onUploadComplete?: (url: string) => void;
    disabled?: boolean;
}

export function FileUpload({
    label,
    type,
    applicationId,
    required = false,
    onUploadComplete,
    disabled = false,
}: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploaded, setUploaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Vérifier le type
        if (!selectedFile.type.startsWith("image/")) {
            setError("Seules les images sont acceptées.");
            return;
        }

        // Vérifier la taille (max 5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError("Le fichier est trop volumineux (max 5MB).");
            return;
        }

        setFile(selectedFile);
        setError(null);
        setUploaded(false);

        // Créer un aperçu
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleUpload = async () => {
        if (!file || !applicationId) return;

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("applicationId", applicationId);
            formData.append("type", type);

            const response = await fetch("/api/documents", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Erreur lors de l'upload.");
                return;
            }

            setUploaded(true);
            onUploadComplete?.(data.url);
        } catch {
            setError("Erreur de connexion au serveur.");
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = () => {
        setFile(null);
        setPreview(null);
        setUploaded(false);
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div className="space-y-2">
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id={`upload-${type}`}
                disabled={disabled}
            />

            {!file ? (
                <label
                    htmlFor={`upload-${type}`}
                    className={`flex items-center justify-between p-4 border border-white/10 bg-black/30 hover:bg-white/5 transition-colors cursor-pointer group ${disabled ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <Upload className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                        <span className="font-sans text-gray-300 group-hover:text-white transition-colors">
                            {label}
                            {!required && (
                                <span className="text-gray-600 text-xs ml-2">(optionnel)</span>
                            )}
                        </span>
                    </div>
                    <span className="text-xs text-gray-600 uppercase tracking-widest font-display">
                        Choisir
                    </span>
                </label>
            ) : (
                <div className="border border-white/10 bg-black/30 p-4">
                    <div className="flex items-start gap-4">
                        {/* Aperçu */}
                        {preview && (
                            <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                                <img
                                    src={preview}
                                    alt="Aperçu"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                            <p className="font-sans text-sm text-white truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                            </p>

                            {error && (
                                <p className="text-xs text-red-400 mt-1">{error}</p>
                            )}

                            {uploaded && (
                                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Uploadé avec succès
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {!uploaded && applicationId && (
                                <button
                                    type="button"
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-display uppercase tracking-wider transition-colors disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Upload"
                                    )}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleRemove}
                                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
