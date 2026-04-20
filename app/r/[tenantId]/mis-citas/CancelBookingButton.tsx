"use client";

import { useState } from "react";

interface CancelBookingButtonProps {
    bookingId: string;
    cancelAction: () => Promise<void>;
}

export function CancelBookingButton({ bookingId, cancelAction }: CancelBookingButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleCancel = async () => {
        setLoading(true);
        await cancelAction();
    };

    if (showConfirm) {
        return (
            <div className="flex gap-2 w-full">
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={loading}
                    className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg transition-colors"
                >
                    Volver
                </button>
                <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="flex-1 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-70"
                >
                    {loading ? "Cancelando..." : "Sí, cancelar"}
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            className="flex-1 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >
            Cancelar
        </button>
    );
}
