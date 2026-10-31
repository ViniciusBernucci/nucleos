# Gateway de telemetria do PoC: a identidade do tenant vem do token, nunca de header do cliente.
worker_processes 1;
pid /tmp/nginx.pid;
events { worker_connections 256; }
http {
  log_format audit 'ts=$time_iso8601 role=$role tenant=$tenant method=$request_method path=$uri status=$status';
  access_log /dev/stdout audit;
  error_log /dev/stderr warn;
  map $http_authorization $tenant {
    default "";
    "Bearer @TOKEN_A@" "tenant-a";
    "Bearer @TOKEN_B@" "tenant-b";
    "Bearer @TOKEN_C@" "tenant-c";
    "Bearer @TOKEN_D@" "tenant-d";
    "Bearer @TOKEN_E@" "tenant-e";
    "Bearer @TOKEN_ADMIN@" "tenant-a|tenant-b|tenant-c|tenant-d|tenant-e";
  }
  map $tenant $role {
    default "tenant";
    "" "none";
    "~\|" "admin";
  }
  server {
    listen 8080;
    # Tenants comuns nao podem consultar com identidade multipla; so o papel admin (auditado em stdout).
    if ($tenant = "") { return 401; }
    location ~ ^/loki/api/v1/(push|query|query_range|labels|label/[a-z_]+/values|series)$ {
      proxy_set_header X-Scope-OrgID $tenant;
      proxy_set_header Authorization "";
      proxy_pass http://loki:3100;
    }
    location ~ ^/tempo/api/(traces/[0-9a-f]+|search)$ {
      if ($role = "admin") { return 403; }
      rewrite ^/tempo/(.*)$ /$1 break;
      proxy_set_header X-Scope-OrgID $tenant;
      proxy_set_header Authorization "";
      proxy_pass http://tempo:3200;
    }
    location = /otlp/v1/traces {
      if ($role = "admin") { return 403; }
      rewrite ^/otlp/(.*)$ /$1 break;
      proxy_set_header X-Scope-OrgID $tenant;
      proxy_set_header Authorization "";
      proxy_pass http://tempo:4318;
    }
    location / { return 404; }
  }
}
