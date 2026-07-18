import { useState, useRef, useCallback, useEffect, useDeferredValue } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import { useAlerts } from '../../hooks/useAlerts';
import { useSankeyLayout } from '../../hooks/useSankeyLayout';
import SankeyNode from './SankeyNode';
import SankeyLink from './SankeyLink';
import SankeyTooltip from './SankeyTooltip';
import styles from './SankeyDiagram.module.css';

export default function SankeyDiagram({
  isSimulating = false,
  viewMode = 'allocated',
  hoveredNodeId = null,
  onHoverNode,
}) {
  const state = useAllocation();
  const deferredState = useDeferredValue(state);
  const alerts = useAlerts();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { nodes, links, sankeyLinkPath } = useSankeyLayout(
    deferredState,
    dimensions.width,
    dimensions.height,
    viewMode
  );

  const handleNodeHover = useCallback((nodeId) => {
    onHoverNode?.(nodeId);
  }, [onHoverNode]);

  const handleNodeLeave = useCallback(() => {
    onHoverNode?.(null);
    setMousePos(null);
  }, [onHoverNode]);

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const getIsHighlighted = useCallback(
    (link) => {
      if (hoveredNodeId === null) return null;
      return (
        link.source.id === hoveredNodeId ||
        link.target.id === hoveredNodeId
      );
    },
    [hoveredNodeId]
  );

  const hoveredNode = hoveredNodeId
    ? nodes.find((n) => n.id === hoveredNodeId) || null
    : null;

  return (
    <div className={styles.sankeyContainer} ref={containerRef} onMouseMove={handleMouseMove}>
      {dimensions.width > 0 && nodes.length > 0 ? (
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          <g>
            {links.map((link, i) => (
              <SankeyLink
                key={`link-${link.source.id}-${link.target.id}-${i}`}
                link={link}
                pathGenerator={sankeyLinkPath}
                isHighlighted={getIsHighlighted(link)}
                isSimulating={isSimulating}
              />
            ))}
          </g>

          <g>
            {nodes.map((node) => {
              const alert = alerts.get(node.id);
              return (
                <SankeyNode
                  key={`node-${node.id}`}
                  node={node}
                  alertLevel={alert?.level || 'normal'}
                  isHovered={hoveredNodeId === node.id}
                  onHover={handleNodeHover}
                  onLeave={handleNodeLeave}
                />
              );
            })}
          </g>
        </svg>
      ) : (
        <div className={styles.emptyState}>
          <span>Calculating flow...</span>
        </div>
      )}

      <SankeyTooltip node={hoveredNode} mousePosition={mousePos} />
    </div>
  );
}
