# node_exporter

## What it is for

node_exporter exposes the metrics of the host that runs the containers: CPU,
memory, swap, filesystems, disk I/O, network traffic and load average. It fills
the gap that application metrics cannot cover, because a slow or unavailable
service can also be caused by a saturated machine.

The project scrapes it as the `node` job. Everything it produces is a normal
Prometheus metric, so it is queried with PromQL and shown on the
**Infrastructure** dashboard.

## How it works

node_exporter runs as a container and reads the host `/proc` and `/sys` through
a read-only bind mount:

```
host /  ->  /host (read-only)  ->  node_exporter --path.rootfs=/host
                                        |
                                        v
                              http://node-exporter:9100/metrics
                                        |
                                        v
                                    Prometheus
```

It does not collect anything itself: like every exporter, it only translates
kernel counters into the Prometheus text format.

The port is published so the raw output can be inspected from the browser or
PowerShell. Inside Compose, Prometheus uses `node-exporter:9100`.

On Docker Desktop (Windows or macOS) the exporter sees the Linux VM that runs
the containers, not the Windows host. That is still the machine whose CPU,
memory and disk are consumed by the stack, so the numbers stay meaningful. On a
native Linux host the same configuration reports the real machine.

## Configuration

| Item | File / value |
| --- | --- |
| container | `concert-ops-node-exporter` |
| image | `prom/node-exporter:v1.8.2` |
| host port | `NODE_EXPORTER_HOST_PORT`, default `9100` |
| host mount | `/:/host:ro` |
| root filesystem flag | `--path.rootfs=/host` |
| scrape job | `node` in `infra/prometheus/prometheus.yml` |
| target label | `instance_type: host`, `team: platform` |
| recording rules | `infra/prometheus/recording-rules.yml` |
| alert rules | `infra/prometheus/alerts.yml` |
| dashboard | `infra/grafana/dashboards/infrastructure.json` |

The filesystem collector skips `/dev`, `/proc`, `/sys`, `/run` and the Docker
data directories, so bind mounts and pseudo filesystems do not flood the
dashboard.

## Metrics

| Area | Metrics | Used for |
| --- | --- | --- |
| CPU | `node_cpu_seconds_total{mode}` | usage percentage and per-mode split |
| load | `node_load1`, `node_load5`, `node_load15` | run queue and CPU saturation |
| memory | `node_memory_MemTotal_bytes`, `node_memory_MemAvailable_bytes` | used and available RAM |
| swap | `node_memory_SwapTotal_bytes`, `node_memory_SwapFree_bytes` | swap usage |
| filesystems | `node_filesystem_size_bytes`, `node_filesystem_avail_bytes` | disk usage per mountpoint and device |
| disk I/O | `node_disk_read_bytes_total`, `node_disk_written_bytes_total` | throughput |
| disk I/O | `node_disk_reads_completed_total`, `node_disk_writes_completed_total` | operations per second |
| network | `node_network_receive_bytes_total`, `node_network_transmit_bytes_total` | throughput |
| network | `node_network_receive_packets_total`, `node_network_transmit_packets_total` | packets per second |
| network | `node_network_receive_errs_total`, `node_network_transmit_errs_total` | interface errors |
| network | `node_network_receive_drop_total`, `node_network_transmit_drop_total` | dropped packets |
| system | `node_boot_time_seconds`, `node_uname_info` | uptime and host identity |

Eight recording rules precompute the values used by the dashboard and alerts:

| Rule | Meaning |
| --- | --- |
| `host:cpu_usage:percent` | 100 minus idle CPU time |
| `host:memory_usage:percent` | used RAM as a percentage of total |
| `host:swap_usage:percent` | used swap as a percentage of total |
| `host:disk_usage:percent` | root filesystem usage, `/var/lib` fallback |
| `host:disk_read:rate5m` | bytes read per second |
| `host:disk_write:rate5m` | bytes written per second |
| `host:network_receive:rate5m` | bytes received per second |
| `host:network_transmit:rate5m` | bytes transmitted per second |

Four alerts use these series:

| Alert | Condition | Severity |
| --- | --- | --- |
| `HostDown` | `up{instance_type="host"} == 0` for 5m | critical |
| `HostHighCpu` | `host:cpu_usage:percent > 85` for 10m | warning |
| `HostHighMemory` | `host:memory_usage:percent > 90` for 10m | warning |
| `HostLowDisk` | `host:disk_usage:percent > 85` for 10m | warning |

## Dashboard

The **Infrastructure** dashboard (`concert-ops-infrastructure`) has 18 panels:

- six stats: CPU, memory, swap, disk usage, CPU cores, uptime;
- CPU usage by mode and load average;
- memory used vs available and swap used vs free;
- disk throughput and disk operations;
- filesystem usage by device;
- network throughput, packets, errors and drops;
- process CPU and resident memory per application service, from
  `prom-client`.

Host CPU, memory, disk and network are also repeated as four stats at the
bottom of the **Concert Ops Overview**, so the golden signals fit on one screen.

## How to verify

1. Raw metrics:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:9100/metrics).StatusCode
```

Expected: `200`.

2. Target health:

```powershell
(Invoke-RestMethod http://localhost:9090/api/v1/targets).data.activeTargets |
  Where-Object { $_.labels.job -eq 'node' } |
  Select-Object health, scrapeUrl
```

Expected: `up`.

3. Recorded values:

```powershell
Invoke-RestMethod "http://localhost:9090/api/v1/query?query=host:cpu_usage:percent"
Invoke-RestMethod "http://localhost:9090/api/v1/query?query=host:disk_usage:percent"
```

4. Rules: `http://localhost:9090/rules` shows the `concert-ops` group with 18
   recording rules and the `default` group with 18 alerts.

5. Dashboard: `http://localhost:3007/d/concert-ops-infrastructure`.

## Useful queries

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)
100 * (node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes) / node_memory_SwapTotal_bytes
100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})
sum by (instance) (rate(node_disk_read_bytes_total{device!~"loop.*|ram.*"}[5m]))
sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[5m]))
node_load1
```

## Where it is used in code

There is no application code: node_exporter is an external exporter. The project
only adds the Compose service, the scrape job, the recording and alert rules,
and the dashboard JSON. All other layers consume the resulting series through
Prometheus exactly like `http_requests_total`.
