<template>
  <section class="stage-view">
    <section class="content-panel is-active" aria-labelledby="fretflow-panel-title">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Practice space</p>
          <h1 id="fretflow-panel-title">FretFlow</h1>
          <p class="panel-copy">吉他自学空间作为独立一级页保留，后续再逐步接入真实练习和课程模块。</p>
        </div>
      </div>

      <div class="fretflow-grid">
        <section class="rail-card">
          <div class="section-head">
            <h2>今日练习</h2>
          </div>
          <div class="widget-display">
            <div class="widget-stat">
              <div>
                <p class="widget-title">Alternate Picking</p>
                <p class="widget-body">12 min</p>
              </div>
              <span class="status-chip is-ready">Ready</span>
            </div>
            <div class="widget-stat">
              <div>
                <p class="widget-title">Chord Changes</p>
                <p class="widget-body">15 min</p>
              </div>
              <span class="status-chip">Queued</span>
            </div>
            <div class="widget-stat">
              <div>
                <p class="widget-title">Ear Training</p>
                <p class="widget-body">8 min</p>
              </div>
              <span class="status-chip">Queued</span>
            </div>
          </div>
        </section>

        <section class="rail-card">
          <div class="section-head">
            <h2>课程进度</h2>
          </div>
          <div class="widget-display">
            <div class="widget-stat">
              <div>
                <p class="widget-title">CAGED 第 3 模块</p>
                <p class="widget-body">主攻连接与音程定位。后续可以把课程列表、练习记录和里程碑逐步接进这里。</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
