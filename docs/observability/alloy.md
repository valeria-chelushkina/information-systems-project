# Alloy

## What it is for

Grafana Alloy collects logs. In this project it replaces Promtail: it discovers
containers through the Docker socket, reads their stdout and ships the lines to
Loki.

Alloy exists so Loki does not have to read Docker files itself. It also adds a
`container` label from the container name, which is used for filtering in
Grafana.

## Configuration

| Item | File |
| --- | --- |
| config | `infra/loki/alloy.config.alloy` |
| container | `concert-ops-alloy` |
| UI | `0.0.0.0:12345` inside the Compose network, not published |
| positions | `alloydata` volume, `/var/lib/alloy/data` |

Flow:

```
Docker socket → discovery.docker → loki.source.docker → loki.write → http://loki:3100
```

## How to verify

1. Container is running:

```powershell
docker compose ps alloy
```

2. Logs show transfer:

```powershell
docker logs concert-ops-alloy --tail 30
```

Healthy signs:

```
finished transferring logs ... written=<bytes> container=<id>
```

3. Confirm delivery in Grafana → **Explore → Loki**:

```logql
{container="concert-ops-alloy"}
{container="concert-ops-ticketing"}
```

4. New containers are picked up automatically: after `docker compose up -d
   notify`, Loki should contain `container="concert-ops-notify"`.

## Where it is used in code

The whole configuration is one file, `infra/loki/alloy.config.alloy`:

```hcl
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = []

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }
}

loki.source.docker "containers" {
  host          = "unix:///var/run/docker.sock"
  targets       = discovery.docker.containers.targets
  relabel_rules = discovery.relabel.containers.rules
  labels        = { job = "docker" }
  forward_to    = [loki.write.local.receiver]
}

loki.write "local" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

The compose command passes this file and the positions path:

```yaml
command:
  - run
  - /etc/alloy/config.alloy
  - --storage.path=/var/lib/alloy/data
```

That is why a new container such as `notify` appears in Loki without editing
Alloy.
