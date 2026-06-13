FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore "TiendaRopaAPI.csproj"
RUN dotnet build "TiendaRopaAPI.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "TiendaRopaAPI.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
COPY --from=build /src/wwwroot ./wwwroot
ENTRYPOINT ["dotnet", "TiendaRopaAPI.dll"]