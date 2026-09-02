sed -i '/const handleDismissWarning/i \
  useEffect(() => {\
    if (standaloneCategory && catalogs.length > 0) {\
      let targetKeyword = "";\
      if (standaloneCategory === "GP_DRAGDRIVE") targetKeyword = "drag drive";\
      else if (standaloneCategory === "GP_CDID") targetKeyword = "cdid";\
      else if (standaloneCategory === "JOKI_DRAGDRIVE") targetKeyword = "joki drag";\
      else if (standaloneCategory === "JOKI_CDID") targetKeyword = "joki cdid";\
      if (targetKeyword) {\
        const found = catalogs.find(c => c.title.toLowerCase().includes(targetKeyword));\
        if (found) {\
          setSelectedGame(found);\
          setShowWarningModal(false);\
        }\
      }\
    }\
  }, [standaloneCategory, catalogs]);\
' src/components/customer/Catalog.tsx
