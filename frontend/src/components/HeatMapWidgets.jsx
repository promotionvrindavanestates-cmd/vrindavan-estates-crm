import React from 'react';

export default function HeatMapWidgets({ leads = [] }) {
  // Extract unique projects, cities, and sources
  const projects = Array.from(new Set(leads.map(l => l.project).filter(Boolean)));
  const cities = Array.from(new Set(leads.map(l => l.city).filter(Boolean)));
  const sources = Array.from(new Set(leads.map(l => l.lead_source).filter(Boolean)));

  const temperatures = ['Hot', 'Warm', 'Cold'];

  // Helper to calculate grid counts
  const getMatrix = (rowKey, rowValues) => {
    const matrix = {};
    let maxVal = 0;

    rowValues.forEach(rowVal => {
      matrix[rowVal] = {};
      temperatures.forEach(temp => {
        const count = leads.filter(l => l[rowKey] === rowVal && String(l.status).toLowerCase() === temp.toLowerCase()).length;
        matrix[rowVal][temp] = count;
        if (count > maxVal) maxVal = count;
      });
    });

    return { matrix, maxVal };
  };

  const projectData = getMatrix('project', projects);
  const cityData = getMatrix('city', cities);
  const sourceData = getMatrix('lead_source', sources);

  const renderGrid = (title, rowValues, matrix, maxVal, rowLabel) => {
    return (
      <div className="card" style={{ flex: 1, minWidth: '300px', marginBottom: '20px' }}>
        <h4 style={{ color: 'var(--primary)', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{title}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hot | Warm | Cold density</span>
        </h4>
        
        {rowValues.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No data available</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Header */}
            <div style={{ display: 'flex', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <div style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rowLabel}</div>
              {temperatures.map(temp => (
                <div key={temp} style={{ width: '60px', textAlign: 'center' }}>{temp}</div>
              ))}
            </div>

            {/* Rows */}
            {rowValues.map(rowVal => (
              <div key={rowVal} style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                <div style={{ flex: 2, fontSize: '12px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '10px' }} title={rowVal}>
                  {rowVal}
                </div>
                {temperatures.map(temp => {
                  const val = matrix[rowVal][temp];
                  // Density calculation
                  const ratio = maxVal > 0 ? val / maxVal : 0;
                  
                  // Premium heatmap cell colors based on status temperatures
                  let cellBg = 'rgba(255, 255, 255, 0.02)';
                  let textColor = 'var(--text-muted)';
                  
                  if (val > 0) {
                    if (temp === 'Hot') {
                      cellBg = `rgba(239, 68, 68, ${0.1 + ratio * 0.7})`; // Red/Hot
                      textColor = '#ffeded';
                    } else if (temp === 'Warm') {
                      cellBg = `rgba(245, 158, 11, ${0.1 + ratio * 0.7})`; // Yellow/Warm
                      textColor = '#fffbeb';
                    } else {
                      cellBg = `rgba(59, 130, 246, ${0.1 + ratio * 0.7})`; // Blue/Cold
                      textColor = '#eff6ff';
                    }
                  }

                  return (
                    <div 
                      key={temp} 
                      style={{ 
                        width: '60px', 
                        height: '32px',
                        background: cellBg,
                        color: textColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: val > 0 ? 'bold' : 'normal',
                        margin: '0 2px',
                        transition: 'transform 0.2s, filter 0.2s',
                        cursor: val > 0 ? 'pointer' : 'default',
                        border: val > 0 ? 'none' : '1px dashed rgba(255,255,255,0.03)'
                      }}
                      onMouseEnter={(e) => {
                        if (val > 0) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.filter = 'brightness(1.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (val > 0) {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.filter = 'none';
                        }
                      }}
                      title={`${val} leads`}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ marginBottom: '15px', color: 'var(--text-main)', fontSize: '15px', fontWeight: 'bold' }}>Lead Density & Temperature Heatmaps</h3>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {renderGrid('Project-Wise Density', projects, projectData.matrix, projectData.maxVal, 'Project Name')}
        {renderGrid('City-Wise Density', cities, cityData.matrix, cityData.maxVal, 'City')}
        {renderGrid('Source-Wise Density', sources, sourceData.matrix, sourceData.maxVal, 'Lead Source')}
      </div>
    </div>
  );
}
