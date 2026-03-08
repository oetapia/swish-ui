

import React, { useState, Suspense } from 'react';

const AlbumArt = React.lazy(() => import('./AlbumArt'));

function QueryAlbum({ variant, meta, localhost, refresh, setRefresh, setMessage, current, volumioSocketCmd, responseQueue }) {

    const [items, setItems] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const isSingleTrack = meta?.type === "song" || (!meta?.type && meta?.duration);
    if (isSingleTrack) return null;

    async function browseUri() {
        if (open) {
            setOpen(false);
            return;
        }
        setOpen(true);
        if (items !== null) return;
        setLoading(true);
        try {
            const url = `${localhost}/api/v1/browse?uri=${encodeURIComponent(meta.uri)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Response status: ${response.status}`);
            const json = await response.json();
            if (json?.navigation?.lists?.length) {
                const allItems = json.navigation.lists.flatMap(list => list.items || []);
                setItems(allItems);
            } else {
                setItems([]);
                setMessage("No items found.");
            }
        } catch (error) {
            console.error("Error browsing URI:", error);
            setMessage("Error loading content");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <li className="query-album">
            {open?
            <button onClick={browseUri} title="Close Elements" className="btn">
                <img src="/icons/icon-arrow-close.svg" alt="Close" className="action" width={16} height={16} />
            </button>
            :
            <button onClick={browseUri} title="Close Elements" className="btn">
                <img src="/icons/icon-arrow-open.svg" alt="View All" className="action" width={16} height={16} />
            </button>
            }
            
            {open && (
                <div className="browse-results">
                    {loading ? "Loading..." : (
                        <Suspense fallback={<li>Loading...</li>}>
                        <ul className="queue-list">
                            {items?.map((item, index) => (
                                <AlbumArt
                                    key={index}
                                    meta={item}
                                    index={index}
                                    refresh={refresh}
                                    setRefresh={setRefresh}
                                    type="search"
                                    variant={item.type === "song" ? "tracks" : (item.type || "tracks")}
                                    localhost={localhost}
                                    setMessage={setMessage}
                                    current={current}
                                    volumioSocketCmd={volumioSocketCmd}
                                    responseQueue={responseQueue}
                                />
                            ))}
                        </ul>
                        </Suspense>
                    )}
                </div>
            )}
        </li>
    );
}

export default QueryAlbum;
