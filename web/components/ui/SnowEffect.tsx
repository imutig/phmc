"use client";

import { useEffect, useState } from "react";
import styles from "./SnowEffect.module.css";

export function SnowEffect() {
    const [snowflakes, setSnowflakes] = useState<Array<{ id: number; left: number; delay: number; duration: number; size: number }>>([]);

    useEffect(() => {
        const flakes = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 5,
            duration: 5 + Math.random() * 10,
            size: 2 + Math.random() * 4,
        }));
        setSnowflakes(flakes);
    }, []);

    return (
        <div className={styles.snowContainer}>
            {snowflakes.map((flake) => (
                <div
                    key={flake.id}
                    className={styles.snowflake}
                    style={{
                        left: `${flake.left}%`,
                        animationDelay: `${flake.delay}s`,
                        animationDuration: `${flake.duration}s`,
                        width: `${flake.size}px`,
                        height: `${flake.size}px`,
                    }}
                />
            ))}
        </div>
    );
}
